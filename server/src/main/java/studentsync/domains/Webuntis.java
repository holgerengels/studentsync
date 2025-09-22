package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import dev.samstevens.totp.code.CodeGenerator;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.exceptions.CodeGenerationException;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import org.apache.commons.io.IOUtils;
import org.apache.commons.io.output.WriterOutputStream;
import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.entity.UrlEncodedFormEntity;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.HttpHeaders;
import org.apache.hc.core5.http.HttpResponse;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import studentsync.base.Configuration;
import studentsync.base.Domain;
import studentsync.base.Student;

import java.io.*;
import java.sql.Date;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Created by holger on 20.12.14.
 */
public class Webuntis
    extends Domain
{
    private List<Student> students;

    public Webuntis() {
        super("webuntis");
    }

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        String url = getConfigString("url"); if (!url.endsWith("/")) url += "/";
        String login = getConfigString("login"); if (login.startsWith("/")) login = login.substring(1);
        String report = getConfigString("report"); if (report.startsWith("/")) report = report.substring(1);
        String fetchStudents = getConfigString("fetchStudents");
        String user = getConfigString("user");
        String password = getConfigString("password");
        String secret = getConfigString("secret");

        CloseableHttpClient client = HttpClientBuilder.create().build();

        start();
        try {
            // authentication
            List<NameValuePair> nameValuePairs = new ArrayList<>(2);
            nameValuePairs.add(new BasicNameValuePair("j_username", user));
            nameValuePairs.add(new BasicNameValuePair("j_password", password));
            nameValuePairs.add(new BasicNameValuePair("token", code(secret)));

            HttpPost post = new HttpPost(url + login);
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            try (final CloseableHttpResponse response = client.execute(post)) {}

            // generate report
            String messageId;
            String reportParams;
            HttpGet get = new HttpGet(url + report + "?" + fetchStudents);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                JsonObject object = new Gson().fromJson(new InputStreamReader(entity.getContent()), JsonObject.class);
                object = object.getAsJsonObject("data");
                messageId = object.getAsJsonPrimitive("messageId").getAsString();
                reportParams = object.getAsJsonPrimitive("reportParams").getAsString();
                EntityUtils.consume(entity);
            }
            // fetch report
            Thread.sleep(3000);
            get = new HttpGet(url + report + "?msgId=" + messageId + "&" + reportParams);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                LineNumberReader reader = new LineNumberReader(new InputStreamReader(entity.getContent()));

                students = new ArrayList<>(2000);
                String line = reader.readLine();
                while ((line = reader.readLine()) != null) {
                    //System.out.println("line = " + line);
                    String[] cols = line.split("\t");
                    if (cols.length < 6)
                        System.out.println("CORRUPT LINE = " + line);
                    else
                        students.add(new Student(cols[0], cols[2], cols[1], cols[3], date(cols[4]), cols[5]));
                }
                EntityUtils.consume(entity);
            }
        }
        catch (IOException | InterruptedException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            stop("read students");
        }
        Collections.sort(students);
        return students;
    }

    public synchronized List<Student> readTutors() {
        String url = getConfigString("url"); if (!url.endsWith("/")) url += "/";
        String login = getConfigString("login"); if (login.startsWith("/")) login = login.substring(1);
        String report = getConfigString("report"); if (report.startsWith("/")) report = report.substring(1);
        String fetchStudents = "name=Class&format=pdf"; //getConfigString("fetchStudents");
        String user = getConfigString("user");
        String password = getConfigString("password");
        String secret = getConfigString("secret");

        CloseableHttpClient client = HttpClientBuilder.create().build();

        start();
        try {
            // authentication
            List<NameValuePair> nameValuePairs = new ArrayList<>(2);
            nameValuePairs.add(new BasicNameValuePair("j_username", user));
            nameValuePairs.add(new BasicNameValuePair("j_password", password));
            nameValuePairs.add(new BasicNameValuePair("token", code(secret)));

            HttpPost post = new HttpPost(url + login);
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            try (final CloseableHttpResponse response = client.execute(post)) {}

            /*
            post = new HttpPost(url + "jsonrpc_web/jsonCalendarService");
            post.setEntity(new StringEntity("""
                    { "id": 1, "method": "setSchoolyear", "params": [15], "jsonrpc": "2.0" }
                    """));
            try (final CloseableHttpResponse response = client.execute(post)) {}
            post = new HttpPost(url + "jsonrpc_web/jsonCalendarService");
            post.setEntity(new StringEntity("""
                    { "id": 2, "method": "setDate", "params": [20230911], "jsonrpc": "2.0" }
                    """));
            try (final CloseableHttpResponse response = client.execute(post)) {}
            post = new HttpPost(url + "jsonrpc_web/jsonCalendarService");
            post.setEntity(new StringEntity("""
                    { "id": 3, "method": "setSchoolyear", "params": [15], "jsonrpc": "2.0" }
                    """));
            try (final CloseableHttpResponse response = client.execute(post)) {}
            */

            // generate report
            String messageId;
            String reportParams;
            HttpGet get = new HttpGet(url + report + "?" + fetchStudents);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                JsonObject object = new Gson().fromJson(new InputStreamReader(entity.getContent()), JsonObject.class);
                object = object.getAsJsonObject("data");
                messageId = object.getAsJsonPrimitive("messageId").getAsString();
                reportParams = object.getAsJsonPrimitive("reportParams").getAsString();
                EntityUtils.consume(entity);
            }
            // fetch report
            Thread.sleep(3000);
            get = new HttpGet(url + report + "?msgId=" + messageId + "&" + reportParams);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                LineNumberReader reader = new LineNumberReader(new InputStreamReader(entity.getContent()));

                students = new ArrayList<>(2000);
                String line = reader.readLine();
                while ((line = reader.readLine()) != null) {
                    //System.out.println("line = " + line);
                    String[] cols = line.split("\t");
                    if (cols.length < 6)
                        System.out.println("CORRUPT LINE = " + line);
                    else
                        students.add(new Student(cols[0], cols[2], cols[1], cols[3], date(cols[4]), cols[5]));
                }
                EntityUtils.consume(entity);
            }
        }
        catch (IOException | InterruptedException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            stop("read students");
        }
        Collections.sort(students);
        return students;
    }

    private static final SimpleDateFormat dateFormat = new SimpleDateFormat("dd.MM.yyyy");

    private Date date(String string) {
        try {
            return string != null && !string.isEmpty() ? new Date(dateFormat.parse(string).getTime()) : null;
        }
        catch (ParseException e) {
            Logger.getLogger(Webuntis.class.getSimpleName()).log(Level.WARNING, e.getMessage(), e);
            return null;
        }
    }

    // request.preventCache=1613224210817
    // setexitdate=1
    // exitDate=2021-02-26
    // exitDateFilter=
    // klasseId=133
    // schoolyearId=-1
    // searchString=
    // studentsForDate=true
    // _studentsForDate=on
    // selId=1794
    // _csrf=88987086-8afa-467f-83d5-24b2351e89fb
    // <input type="hidden" name="_csrf" value="21767af5-44dd-4309-916e-136bbb0e282f">

    public void writeExitDates(Map<String, Date> map) {
        String url = Configuration.getInstance().getString("webuntis","url"); if (!url.endsWith("/")) url += "/";
        String login = Configuration.getInstance().getString("webuntis", "login"); if (login.startsWith("/")) login = login.substring(1);
        String exitDate = Configuration.getInstance().getString("webuntis", "exitDate"); if (exitDate.startsWith("/")) exitDate = exitDate.substring(1);
        String user = Configuration.getInstance().getString("webuntis", "user");
        String password = Configuration.getInstance().getString("webuntis", "password");
        String secret = getConfigString("secret");

        try (final CloseableHttpClient client = HttpClientBuilder.create()
                .setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36")
                .build();
        ) {
            // authentication
            List<NameValuePair> nameValuePairs = new ArrayList<>(2);
            nameValuePairs.add(new BasicNameValuePair("j_username", user));
            nameValuePairs.add(new BasicNameValuePair("j_password", password));
            nameValuePairs.add(new BasicNameValuePair("token", code(secret)));

            HttpPost post = new HttpPost(url + login);
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            try (final CloseableHttpResponse response = client.execute(post)) {}

            String csrf;
            HttpGet get = new HttpGet(url + exitDate);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                StringWriter writer = new StringWriter();
                WriterOutputStream out = new WriterOutputStream(writer);
                entity.writeTo(out);
                out.flush();
                String string = writer.toString();
                EntityUtils.consume(entity);
                String _csrf = "<input type=\"hidden\" name=\"_csrf\" value=\"";
                int start = string.indexOf(_csrf);
                int end = string.indexOf("\" />", start + _csrf.length());
                csrf = string.substring(start + _csrf.length(), end);
                System.out.println("csrf = " + csrf);
            }

            for (Map.Entry<String, Date> entry : map.entrySet()) {
                String selId;
                post = new HttpPost(url + exitDate);
                nameValuePairs = new ArrayList<>(6);
                nameValuePairs.add(new BasicNameValuePair("exitDateFilter", ""));
                nameValuePairs.add(new BasicNameValuePair("klasseId", "-1"));
                nameValuePairs.add(new BasicNameValuePair("schoolyearId", "-1"));
                nameValuePairs.add(new BasicNameValuePair("searchString", entry.getKey()));
                nameValuePairs.add(new BasicNameValuePair("_studentsForDate", "on"));
                nameValuePairs.add(new BasicNameValuePair("_csrf", csrf));
                post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
                post.setHeader(HttpHeaders.ACCEPT, "*/*");
                post.setHeader(HttpHeaders.ACCEPT_ENCODING, "gzip deflate br");
                post.setHeader(HttpHeaders.ACCEPT_LANGUAGE, "de-DE,de");
                post.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
                post.setHeader(HttpHeaders.HOST, "nessa.webuntis.com");
                post.setHeader("Origin", "https://nessa.webuntis.com");
                post.setHeader(HttpHeaders.USER_AGENT, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36");
                post.setHeader("X-CSRF-TOKEN", csrf);
                post.setHeader("X-Requested-With", "XMLHttpRequest");
                try (final CloseableHttpResponse response = client.execute(post)) {
                    HttpEntity entity = response.getEntity();
                    StringWriter writer = new StringWriter();
                    WriterOutputStream out = new WriterOutputStream(writer);
                    entity.writeTo(out);
                    out.flush();
                    String string = writer.toString();
                    EntityUtils.consume(entity);
                    String _selId = "<input type=\"checkbox\" name=\"selId\" value=\"";
                    int start = string.indexOf(_selId);
                    int end = string.indexOf("\" />", start + _selId.length());
                    selId = string.substring(start + _selId.length(), end);
                    System.out.println("selId = " + selId);
                }

                post = new HttpPost(url + exitDate);
                nameValuePairs = new ArrayList<>(4);
                nameValuePairs.add(new BasicNameValuePair("setexitdate", "1"));
                nameValuePairs.add(new BasicNameValuePair("exitDate", "" + entry.getValue()));
                nameValuePairs.add(new BasicNameValuePair("selId", selId));
                nameValuePairs.add(new BasicNameValuePair("_csrf", csrf));
                post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
                post.setHeader(HttpHeaders.ACCEPT, "*/*");
                post.setHeader(HttpHeaders.ACCEPT_ENCODING, "gzip deflate br");
                post.setHeader(HttpHeaders.ACCEPT_LANGUAGE, "de-DE,de");
                post.setHeader(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
                post.setHeader(HttpHeaders.HOST, "nessa.webuntis.com");
                post.setHeader("Origin", "https://nessa.webuntis.com");
                post.setHeader(HttpHeaders.USER_AGENT, "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36");
                post.setHeader("X-CSRF-TOKEN", csrf);
                post.setHeader("X-Requested-With", "XMLHttpRequest");
                try (final CloseableHttpResponse response = client.execute(post)) {
                    HttpEntity entity = response.getEntity();
                    //IOUtils.copy(entity.getContent(), System.out);
                    EntityUtils.consume(entity);
                }
            }
        }
        catch (IOException e) {


        }
    }

    public String code(String secret) {
        try {
            TimeProvider timeProvider = new SystemTimeProvider();
            CodeGenerator codeGenerator = new DefaultCodeGenerator();
            long time = Math.round(Math.floor(timeProvider.getTime()/30.0));
            return codeGenerator.generate(secret, time);
        } catch (CodeGenerationException e) {
            throw new RuntimeException(e);
        }
    }

    public static void main(String[] args) throws Exception {
        try { Configuration.getInstance().setConfigPath(args[0]); } catch (Exception e) { System.out.println("e = " + e); }
        Webuntis webuntis = new Webuntis();
        List<Student> students = webuntis.readStudents();
        List<String> list = students.stream().map(student -> Objects.toString(student, null)).collect(Collectors.toList());
        System.out.println("students = " + String.join("\n", list));
    }
}
