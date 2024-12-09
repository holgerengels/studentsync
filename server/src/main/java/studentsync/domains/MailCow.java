package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import org.apache.hc.client5.http.classic.methods.HttpDelete;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.classic.methods.HttpPut;
import org.apache.hc.client5.http.entity.EntityBuilder;
import org.apache.hc.client5.http.entity.UrlEncodedFormEntity;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import org.apache.hc.core5.net.URIBuilder;
import studentsync.base.*;

import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.*;

import static studentsync.domains.JSON.string;

/**
 * Created by holger on 20.12.14.
 */
public class MailCow
    extends Domain
{
    private List<Student> students;
    private ArrayList<String> allTeachers;
    private ArrayList<String> classTeachers;
    private String authorization;

    static ThreadLocal<PoolingHttpClientConnectionManager> connectionManager = ThreadLocal.withInitial(() -> {
        // ExtendedTrustManager.getInstance(Configuration.getInstance().getConfig());
        //return PoolingHttpClientConnectionManagerBuilder.create().build();

        try {
            SSLContext sslContext = SSLContext.getInstance("TLSv1.3");
            sslContext.init(null, null, new SecureRandom());
            //sslContext.init(null, new TrustManager[]{ExtendedTrustManager.INSTANCE}, new SecureRandom());

            SSLConnectionSocketFactory sslConnectionSocketFactory = new SSLConnectionSocketFactory(sslContext, new String[]
                    {"TLSv1.3"}, null, (hostname, session) -> true);

            return PoolingHttpClientConnectionManagerBuilder.create()
                    .setSSLSocketFactory(sslConnectionSocketFactory)
                    .build();
        }
        catch (NoSuchAlgorithmException | KeyManagementException e) {
            throw new RuntimeException(e);
        }
    });

    ThreadLocal<CloseableHttpClient> client = ThreadLocal.withInitial(() -> HttpClientBuilder.create().setConnectionManager(connectionManager.get()).build());

    public MailCow() {
        super("mailcow");
    }

    @Override
    public void release() {
    }

    @Override
    public int getFields() {
        return Diff.COMPARE_CLASS | Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME;
    }

    private String authorize(String user, String password) throws IOException {
        String authURL = getConfigString("apiURL");

        String token;
        // login page .. obtain token
        HttpGet get = new HttpGet(authURL);
        try (final CloseableHttpResponse response = client.get().execute(get)) {
            HttpEntity entity = response.getEntity();
            String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
            token = extractToken(string);
            EntityUtils.consume(entity);
        }
        System.out.println("token = " + token);
        HttpPost post = new HttpPost(authURL);
        final List<NameValuePair> params = new ArrayList<NameValuePair>();
        params.add(new BasicNameValuePair("login_user", user));
        params.add(new BasicNameValuePair("pass_user", password));
        params.add(new BasicNameValuePair("csrf_token", token));
        post.setEntity(new UrlEncodedFormEntity(params));
        try (final CloseableHttpResponse response = client.get().execute(post)) {
            HttpEntity entity = response.getEntity();
            String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
            token = extractToken(string);
            EntityUtils.consume(entity);
        }
        System.out.println("token = " + token);
        return token;
    }

    private static String extractToken(String string) {
        int start = string.indexOf("value=", string.indexOf("csrf_token") - 100) + 7;
        int end = string.indexOf("\"", start);
        return string.substring(start, end);
    }

    public synchronized List<Student> readTeachers() {
        return readStudents();
    }
    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        students = new ArrayList<Student>();

        String user = getConfigString("user");
        String password = getConfigString("password");

        start();
        try {
            authorization = authorize(user, password);
            HttpEntity responseEntity;

            String apiURL = getConfigString("apiURL"); if (!apiURL.endsWith("/")) apiURL += "/";

            NameValuePair[] params = new NameValuePair[] {
                    new BasicNameValuePair("draw", "1"),
                    new BasicNameValuePair("start", "0"),
                    new BasicNameValuePair("length", "200"),
                    new BasicNameValuePair("order[0][column]", "0"),
                    new BasicNameValuePair("order[0][dir]", "asc"),
                    new BasicNameValuePair("search[value]", ""),
                    new BasicNameValuePair("search[regex]","false"),
                    new BasicNameValuePair("columns[0][data]","username"),
                    new BasicNameValuePair("columns[0][name]",""),
                    new BasicNameValuePair("columns[0][searchable]","true"),
                    new BasicNameValuePair("columns[0][orderable]","true"),
                    new BasicNameValuePair("columns[0][search][value]",""),
                    new BasicNameValuePair("columns[0][search][regex]","false"),
            };
            HttpGet get = new HttpGet(apiURL + "get/mailbox/datatables");
            URI uri = new URIBuilder(get.getUri()).addParameters(Arrays.asList(params)).build();
            get.setUri(uri);
            try (final CloseableHttpResponse response = client.get().execute(get)) {
                responseEntity = response.getEntity();
                JsonObject jsonObject = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonObject.class);
                EntityUtils.consume(responseEntity);
                jsonObject.getAsJsonArray("data").forEach(jsonElement -> {
                    JsonObject object = (JsonObject)jsonElement;
                    JsonArray tags = object.getAsJsonArray("tags");
                    if (tags != null && tags.contains(new JsonPrimitive("ldap"))) {
                        Student student = new Student(
                                string(object, "local_part"),
                                string(object, "name"),
                                string(object, "name"));
                        student.setEMail(string(object, "username"));
                        students.add(student);
                    }
                });
            }
            get = new HttpGet(apiURL + "get/alias/all");
            //URI uri = new URIBuilder(get.getUri()).addParameters(Arrays.asList(params)).build();
            //get.setUri(uri);
            try (final CloseableHttpResponse response = client.get().execute(get)) {
                responseEntity = response.getEntity();
//                String string = new String(responseEntity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                JsonArray jsonArray = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonArray.class);
                EntityUtils.consume(responseEntity);
                jsonArray.forEach(jsonElement -> {
                    JsonObject object = (JsonObject)jsonElement;
                    String address = object.getAsJsonPrimitive("address").getAsString();
                    if ("lehrer@valckenburgschule.de".equals(address)) {
                        String to = object.getAsJsonPrimitive("goto").getAsString();
                        Arrays.stream(to.split(",")).map(e -> e.substring(0, e.indexOf("@"))).forEach(student -> {});
                    }
                    JsonArray tags = object.getAsJsonArray("tags");
                    if (tags != null && tags.contains(new JsonPrimitive("ldap"))) {
                        Student student = new Student(
                                string(object, "local_part"),
                                string(object, "name"),
                                string(object, "name"));
                        students.add(student);
                    }
                });
            }
            Collections.sort(students);
            return students;
        }
        catch (IOException | URISyntaxException e) {
            throw new RuntimeException(e);
        } finally {
            stop("read students");
        }
    }

    public synchronized List<String> readAllTeachers() {
        if (allTeachers != null)
            return allTeachers;

        allTeachers = new ArrayList<String>();

        String user = getConfigString("user");
        String password = getConfigString("password");

        start();
        try {
            authorization = authorize(user, password);
            HttpEntity responseEntity;

            String apiURL = getConfigString("apiURL"); if (!apiURL.endsWith("/")) apiURL += "/";

            HttpGet get = new HttpGet(apiURL + "get/alias/all");
            //URI uri = new URIBuilder(get.getUri()).addParameters(Arrays.asList(params)).build();
            //get.setUri(uri);
            try (final CloseableHttpResponse response = client.get().execute(get)) {
                responseEntity = response.getEntity();
                JsonArray jsonArray = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonArray.class);
                EntityUtils.consume(responseEntity);
                jsonArray.forEach(jsonElement -> {
                    JsonObject object = (JsonObject)jsonElement;
                    String address = object.getAsJsonPrimitive("address").getAsString();
                    if ("lehrer@valckenburgschule.de".equals(address)) {
                        String to = object.getAsJsonPrimitive("goto").getAsString();
                        Arrays.stream(to.split(",")).map(e -> e.substring(0, e.indexOf("@"))).forEach(email -> allTeachers.add(email));
                    }
                });
            }
            Collections.sort(allTeachers);
            return allTeachers;
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        } finally {
            stop("read allTeachers");
        }
    }
    public synchronized List<String> readClassTeachers() {
        if (classTeachers != null)
            return classTeachers;

        classTeachers = new ArrayList<String>();

        String user = getConfigString("user");
        String password = getConfigString("password");

        start();
        try {
            authorization = authorize(user, password);
            HttpEntity responseEntity;

            String apiURL = getConfigString("apiURL"); if (!apiURL.endsWith("/")) apiURL += "/";

            HttpGet get = new HttpGet(apiURL + "get/alias/all");
            //URI uri = new URIBuilder(get.getUri()).addParameters(Arrays.asList(params)).build();
            //get.setUri(uri);
            try (final CloseableHttpResponse response = client.get().execute(get)) {
                responseEntity = response.getEntity();
                JsonArray jsonArray = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonArray.class);
                EntityUtils.consume(responseEntity);
                jsonArray.forEach(jsonElement -> {
                    JsonObject object = (JsonObject)jsonElement;
                    String address = object.getAsJsonPrimitive("address").getAsString();
                    if ("klassenlehrer@valckenburgschule.de".equals(address)) {
                        String to = object.getAsJsonPrimitive("goto").getAsString();
                        Arrays.stream(to.split(",")).map(e -> e.substring(0, e.indexOf("@"))).forEach(email -> classTeachers.add(email));
                    }
                });
            }
            Collections.sort(classTeachers);
            return classTeachers;
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        } finally {
            stop("read classTeachers");
        }
    }

    public static void main(String[] args) throws Exception {
        Configuration.getInstance().setConfigPath(args[0]);
        /*
        MailCow mailcow = new MailCow();
        List<Student> students = mailcow.readTeachers();
        Student.listStudents(System.out, students);
        List<String> allTeachers = mailcow.readAllTeachers();
        System.out.println("allTeachers = " + allTeachers);
        List<String> classTeachers = mailcow.readClassTeachers();
        System.out.println("classTeachers = " + classTeachers);
         */
        Report report = new MailingListsReportTask().execute();
        System.out.println("report = " + report);
    }
}

