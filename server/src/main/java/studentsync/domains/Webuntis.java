package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.message.BasicNameValuePair;
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

        HttpClient client = HttpClientBuilder.create().build();

        start();
        try {
            // authentication
            List<NameValuePair> nameValuePairs = new ArrayList<>(1);
            nameValuePairs.add(new BasicNameValuePair("j_username", user));
            nameValuePairs.add(new BasicNameValuePair("j_password", password));
            HttpPost post = new HttpPost(url + login);
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            HttpResponse response = client.execute(post);

            // generate report
            HttpGet get = new HttpGet(url + report + "?" + fetchStudents);
            response = client.execute(get);
            JsonObject object = new Gson().fromJson(new InputStreamReader(response.getEntity().getContent()), JsonObject.class);
            object = object.getAsJsonObject("data");
            String messageId = object.getAsJsonPrimitive("messageId").getAsString();
            String reportParams = object.getAsJsonPrimitive("reportParams").getAsString();

            // fetch report
            Thread.sleep(3000);
            get = new HttpGet(url + report + "?msgId=" + messageId + "&" + reportParams);
            response = client.execute(get);
            LineNumberReader reader = new LineNumberReader(new InputStreamReader(response.getEntity().getContent()));

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
            return string != null && string.length() > 0 ? new Date(dateFormat.parse(string).getTime()) : null;
        }
        catch (ParseException e) {
            Logger.getLogger(Webuntis.class.getSimpleName()).log(Level.WARNING, e.getMessage(), e);
            return null;
        }
    }

    public static void main(String[] args) throws Exception {
        Configuration.getInstance().setConfigPath(args[0]);
        Webuntis webuntis = new Webuntis();
        List<Student> students = webuntis.readStudents();
        List<String> list = students.stream().map(student -> Objects.toString(student, null)).collect(Collectors.toList());
        System.out.println("students = " + String.join("\n", list));
    }

    /*
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClientBuilder.create().build();
        HttpPost post = new HttpPost("https://webuntis.valckenburgschule.de/WebUntis/j_spring_security_check?school=VU");

        List<NameValuePair> nameValuePairs = new ArrayList<>(1);
        nameValuePairs.add(new BasicNameValuePair("j_username", "h.engels"));
        nameValuePairs.add(new BasicNameValuePair("j_password", "3f3l@nt!"));
        post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
        HttpResponse response = client.execute(post);

        BufferedReader rd = new BufferedReader(new InputStreamReader(response.getEntity().getContent()));

        HttpGet get = new HttpGet("https://webuntis.valckenburgschule.de/WebUntis/reports.do?name=Student&format=csv&klasseId=-1&studentsForDate=true");
        response = client.execute(get);
        rd = new BufferedReader(new InputStreamReader(response.getEntity().getContent()));
        IOUtils.copy(rd, System.out);
    }
    */
}
