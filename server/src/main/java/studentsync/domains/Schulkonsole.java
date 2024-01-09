package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.apache.hc.client5.http.classic.methods.HttpDelete;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.classic.methods.HttpPut;
import org.apache.hc.client5.http.entity.EntityBuilder;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import studentsync.base.*;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import java.io.IOException;
import java.io.InputStreamReader;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.*;

import static studentsync.domains.JSON.string;

/**
 * Created by holger on 20.12.14.
 */
public class Schulkonsole
    extends ManageableDomain
{
    private List<Student> students;
    private Map<String, Integer> ids;
    private Map<String, Integer> classes;
    private String authorization;

    static ThreadLocal<PoolingHttpClientConnectionManager> connectionManager = ThreadLocal.withInitial(() -> {
        // ExtendedTrustManager.getInstance(Configuration.getInstance().getConfig());
        //return PoolingHttpClientConnectionManagerBuilder.create().build();

        try {
            SSLContext sslContext = SSLContext.getInstance("TLSv1.3");
            //sslContext.init(null, new TrustManager[]{ExtendedTrustManager.INSTANCE}, new SecureRandom());

            SSLConnectionSocketFactory sslConnectionSocketFactory = new SSLConnectionSocketFactory(sslContext, new String[]
                    {"TLSv1.3"}, null, (hostname, session) -> true);

            return PoolingHttpClientConnectionManagerBuilder.create()
                    .setSSLSocketFactory(sslConnectionSocketFactory)
                    .build();
        }
        catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    });

    ThreadLocal<CloseableHttpClient> client = ThreadLocal.withInitial(() -> HttpClientBuilder.create().setConnectionManager(connectionManager.get()).build());

    public Schulkonsole() {
        super("schulkonsole");
    }

    @Override
    public void release() {
    }

    @Override
    public int getFields() {
        return Diff.COMPARE_CLASS | Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME;
    }
    private String authorize(String user, String password) throws IOException {
        HttpEntity entity = EntityBuilder.create().setParameters(
                new BasicNameValuePair("grant_type", "password"),
                new BasicNameValuePair("username", user),
                new BasicNameValuePair("password", password)
        ).build();

        String tokenURL = getConfigString("tokenURL");
        HttpPost post = new HttpPost(tokenURL);
        post.setEntity(entity);
        HttpEntity responseEntity;
        try (final CloseableHttpResponse response = client.get().execute(post)) {
            responseEntity = response.getEntity();
            JsonObject token = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonObject.class);
            EntityUtils.consume(responseEntity);
            return token.get("token_type").getAsString() + " " + token.get("access_token").getAsString();
        }
    }

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        students = new ArrayList<Student>();
        ids = new HashMap<>();
        classes = new HashMap<>();

        String user = getConfigString("user");
        String password = getConfigString("password");

        start();
        try {
            authorization = authorize(user, password);
            HttpEntity responseEntity;

            String apiURL = getConfigString("apiURL"); if (!apiURL.endsWith("/")) apiURL += "/";
            HttpGet get = new HttpGet(apiURL + "students");
            get.setHeader("Authorization", authorization);
            try (final CloseableHttpResponse response = client.get().execute(get)) {
                responseEntity = response.getEntity();
                JsonArray jsonArray = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonArray.class);
                EntityUtils.consume(responseEntity);
                jsonArray.forEach(jsonElement -> {
                    JsonObject jsonObject = (JsonObject)jsonElement;
                    Student student = new Student(
                            string(jsonObject, "userName"),
                            string(jsonObject,"givenName"),
                            string(jsonObject, "surname"),
                            null, null,
                            string(jsonObject, "schoolClass").toUpperCase());
                    students.add(student);
                    ids.put(student.account, Integer.parseInt(string(jsonObject, "id")));
                });
            }
            get = new HttpGet(apiURL + "school/schoolClasses");
            get.setHeader("Authorization", authorization);
            try (final CloseableHttpResponse response = client.get().execute(get)) {
                responseEntity = response.getEntity();
                JsonArray jsonArray = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonArray.class);
                jsonArray.forEach(jsonElement -> {
                    JsonObject jsonObject = (JsonObject) jsonElement;
                    classes.put(string(jsonObject, "name"), Integer.parseInt(string(jsonObject, "id")));
                });
            }
            Collections.sort(students);
            return students;
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        }
        finally {
            stop("read students");
        }
    }

    public void addStudent(Student student) {
        String apiURL = getConfigString("apiURL"); if (!apiURL.endsWith("/")) apiURL += "/";
        HttpPost post = new HttpPost(apiURL + "students");
        post.setHeader("Authorization", authorization);
        JsonObject object = new JsonObject();
        object.addProperty("schoolType", "1");
        object.addProperty("comments", "");
        object.addProperty("externalIdentifier", "");
        object.addProperty("mySite", "");
        object.addProperty("userName", student.account);
        object.addProperty("givenName", student.firstName);
        object.addProperty("surname", student.lastName);
        object.addProperty("schoolClass", "" + classes.get(student.clazz.toLowerCase()));
        object.addProperty("isInternetLocked", false);
        object.addProperty("isDeactivated", false);
        object.addProperty("homeDirectory", "");
        object.addProperty("password", getConfigString("initialPassword"));
        object.addProperty("passwordPolicy", "1");
        HttpEntity entity = EntityBuilder.create()
                .setContentType(ContentType.APPLICATION_JSON)
                .setText(object.toString()).build();
        post.setEntity(entity);

        try (final CloseableHttpResponse response = client.get().execute(post)) {
            HttpEntity responseEntity = response.getEntity();
            JsonObject jsonObject = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonObject.class);
            EntityUtils.consume(responseEntity);
            System.out.println("jsonObject = " + jsonObject);
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        }

    }

    public void removeStudent(Student student) {
        String apiURL = getConfigString("apiURL"); if (!apiURL.endsWith("/")) apiURL += "/";
        HttpDelete delete = new HttpDelete(apiURL + "students");
        delete.setHeader("Authorization", authorization);
        JsonArray array = new JsonArray();
        array.add(ids.get(student.account));
        HttpEntity entity = EntityBuilder.create()
                .setContentType(ContentType.APPLICATION_JSON)
                .setText(array.toString()).build();
        delete.setEntity(entity);

        try (final CloseableHttpResponse response = client.get().execute(delete)) {
            HttpEntity responseEntity = response.getEntity();
            JsonObject jsonObject = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonObject.class);
            EntityUtils.consume(responseEntity);
            System.out.println("jsonObject = " + jsonObject);
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public void changeStudent(Student student) {
        readStudents();

        String apiURL = "https://sp01:43001/api/"; //getConfigString("url"); if (!url.endsWith("/")) url += "/";

        Integer id = ids.get(student.getAccount());
        HttpPut put = new HttpPut(apiURL + "students/" + id);
        put.setHeader("Authorization", authorization);
        JsonObject object = new JsonObject();
        object.addProperty("schoolType", "1");
        object.addProperty("comments", "");
        object.addProperty("externalIdentifier", "");
        object.addProperty("mySite", "");
        object.addProperty("userName", student.getAccount());
        object.addProperty("givenName", student.getFirstName());
        object.addProperty("surname", student.getLastName());
        object.addProperty("schoolClass", "" + classes.get(student.getClazz().toLowerCase()));
        object.addProperty("isInternetLocked", false);
        object.addProperty("isDeactivated", false);
        object.addProperty("homeDirectory", "\\\\SP01\\MLData\\Benutzer\\SUS\\" + student.getAccount());
        HttpEntity entity = EntityBuilder.create()
                .setContentType(ContentType.APPLICATION_JSON)
                .setText(object.toString()).build();
        put.setEntity(entity);

        try (final CloseableHttpResponse response = client.get().execute(put)) {
            HttpEntity responseEntity = response.getEntity();
            JsonObject jsonObject = new Gson().fromJson(new InputStreamReader(responseEntity.getContent()), JsonObject.class);
            EntityUtils.consume(responseEntity);
            System.out.println("jsonObject = " + jsonObject);
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public static void main(String[] args) throws Exception {
        Configuration.getInstance().setConfigPath(args[0]);
        JsonObject config = Configuration.getInstance().getConfig().getAsJsonObject("schulkonsole");
        Schulkonsole schulkonsole = new Schulkonsole();
        List<Student> students = schulkonsole.readStudents();
        Student.listStudents(System.out, students);
        //schulkonsole.addStudent(new Student("lili", "li", "li", null, null, "testklasse"));
        /*
        List<Student> students = schulkonsole.readStudents();
        Student.listStudents(System.out, students);
        schulkonsole.changeStudent(new Student("lala.lol", "Lolo", "Lala", null, null, "gym22e"));
        //schulkonsole.addStudent(new Student("lala.lol", "Lolo", "Lala", null, null, "gym22e"));
        schulkonsole.removeStudent(new Student("lala.lol", "Lolo", "Lala"));

         */
    }
}

