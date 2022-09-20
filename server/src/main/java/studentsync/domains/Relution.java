package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.http.message.BasicHeader;
import studentsync.base.Configuration;
import studentsync.base.Domain;
import studentsync.base.Student;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.ObjectInputFilter;
import java.sql.Date;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Created by holger on 20.12.14.
 */
public class Relution
    extends Domain
{
    private List<Student> students;
    private List<Student> deviceOwners;

    public Relution() {
        super("relution");
    }

    public synchronized List<Student> readStudents() {
        if (deviceOwners != null)
            return deviceOwners;

        deviceOwners = readDeviceOwners().stream().distinct().collect(Collectors.toList());
        return deviceOwners;
    }

    public synchronized List<Student> readDeviceOwners() {
        if (students != null)
            return students;

        String url = getConfigString("url"); if (!url.endsWith("/")) url += "/";
        String login = getConfigString("login"); if (login.startsWith("/")) login = login.substring(1);
        String devices = getConfigString("devices"); if (devices.startsWith("/")) devices = devices.substring(1);
        String user = getConfigString("user");
        String password = getConfigString("password");

        CloseableHttpClient client = HttpClientBuilder.create().build();

        start();
        try {
            // authentication
            JsonObject auth = new JsonObject();
            auth.addProperty("userName", user);
            auth.addProperty("password", password);

            HttpPost post = new HttpPost(url + login);
            post.setHeader(new BasicHeader("Content-Type", "application/json"));
            post.setEntity(new StringEntity(auth.toString()));
            try (final CloseableHttpResponse response = client.execute(post)) {}

            HttpGet get = new HttpGet(url + devices);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                JsonObject object = new Gson().fromJson(new InputStreamReader(entity.getContent()), JsonObject.class);
                JsonArray lines = object.getAsJsonArray("results");
                students = new ArrayList<>();
                lines.forEach(l -> {
                    JsonObject o = (JsonObject) l;
                    if ("IOS".equals(o.getAsJsonPrimitive("platform").getAsString())
                            && !"DELETED".equals(o.getAsJsonPrimitive("status").getAsString())
                    && !"VALCKENBURGSCHULE Device User".equals(o.getAsJsonPrimitive("userName").getAsString()))
                        students.add(new Student(o.getAsJsonPrimitive("userName").getAsString(), null, null));
                });
                EntityUtils.consume(entity);
            }
        }
        catch (IOException e) {
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
            Logger.getLogger(Relution.class.getSimpleName()).log(Level.WARNING, e.getMessage(), e);
            return null;
        }
    }

    public static void main(String[] args) throws Exception {
        Configuration.getInstance().setConfigPath(args[0]);
        JsonObject config = Configuration.getInstance().getConfig().getAsJsonObject("relution");
        List<String> tabletClasses = StreamSupport.stream(config.getAsJsonArray("tabletClasses").spliterator(), false)
                .map(JsonElement::getAsString).sorted().collect(Collectors.toList());
        
        Relution relution = new Relution();
        ASV asv = new ASV();
        Untis untis = new Untis();

        List<Student> deviceOwners = relution.readStudents();
        List<Student> students = asv.readStudents();
        List<Student> teachers = untis.readTeachers().values().stream().map(s -> new Student(s, null, null)).sorted().collect(Collectors.toList());

        System.out.println(deviceOwners.size() + " deviceOwners = " + deviceOwners);

        System.out.println(students.size() + " students = " + students);
        System.out.println(teachers.size() + " teachers = " + teachers);
        List<Student> tabletClassStudents = new ArrayList<>();
        List<Student> otherClassStudents = new ArrayList<>();
        students.forEach(s -> {
            if (tabletClasses.contains(s.getClazz()))
                tabletClassStudents.add(s);
            else
                otherClassStudents.add(s);
        });
        System.out.println(tabletClassStudents.size() + " tablet class students = " + tabletClassStudents);
        System.out.println(otherClassStudents.size() + " other class students = " + otherClassStudents);

        List<Student> persons = new ArrayList<>();
        persons.addAll(students);
        persons.addAll(teachers);
        Collections.sort(persons);

        List<Student> duplicates = relution.readDeviceOwners().stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting())).entrySet().stream().filter(e -> e.getValue() != 1).map(Map.Entry::getKey).collect(Collectors.toList());
        System.out.println(duplicates.size() + " people own multiple devices = " + duplicates);

        List<Student> unknownOwners = new ArrayList<>(deviceOwners);
        unknownOwners.removeAll(persons);
        System.out.println(unknownOwners.size() + " unknown device owners = " + unknownOwners);

        List<Student> nonTabletClassOwners = new ArrayList<>();
        nonTabletClassOwners.addAll(deviceOwners);
        nonTabletClassOwners.removeAll(unknownOwners);
        nonTabletClassOwners.removeAll(teachers);
        nonTabletClassOwners.removeAll(tabletClassStudents);
        System.out.println(nonTabletClassOwners.size() + " device owners not in tablet class = " + nonTabletClassOwners);

        List<Student> tabletClassNonOwners = new ArrayList<>();
        tabletClassNonOwners.addAll(tabletClassStudents);
        tabletClassNonOwners.removeAll(deviceOwners);
        System.out.println(tabletClassNonOwners.size() + " tablet class students without device = " + tabletClassNonOwners);
    }
}