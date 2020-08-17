package studentsync.domains;

import com.google.gson.JsonObject;
import org.lightcouch.CouchDbClient;
import org.lightcouch.CouchDbProperties;
import org.lightcouch.NoDocumentException;
import org.lightcouch.View;
import studentsync.base.Configuration;
import studentsync.base.Domain;
import studentsync.base.Student;

import java.io.IOException;
import java.sql.Date;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Created by holger on 20.12.14.
 */
public class Bridge
    extends Domain
{
    private List<Student> students;

    public Bridge() {
        super("bridge");
    }

    @Override
    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        View view = getClient("sv-data").view("data/students")
            .reduce(false)
            .includeDocs(true);
        students = view.query(Map.class).stream().map(
            map -> new Student(
                (String)map.get("_id"),
                (String)map.get("firstName"),
                (String)map.get("lastName"),
                (String)map.get("gender"),
                date((String)map.get("birthDate")),
                (String)map.get("clazz")))
            .collect(Collectors.toList());

        return students;
    }

    Date date(String date) {
        try {
            return date != null ? new Date(new SimpleDateFormat("yyyy-MM-dd").parse(date).getTime()) : null;
        }
        catch (ParseException e) {
            e.printStackTrace();
            return null;
        }
    }

    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        Bridge bridge = new Bridge();
        SVP svp = new SVP();
        Map<String, Object> student = svp.loadStudent("bartsch.lau8449");
        bridge.addStudent(student);
        student.put("id", student.remove("_id"));
        bridge.updateStudent(student);
        bridge.removeStudent((String)student.get("_id"));
    }

    protected CouchDbClient createClient(String name) {
        CouchDbProperties couchProperties = new CouchDbProperties()
            .setDbName(name)
            .setCreateDbIfNotExist(true)
            .setProtocol("http")
            .setHost(getConfigString("host"))
            .setPort(Integer.parseInt(getConfigString("port")))
            .setUsername(getConfigString("user"))
            .setPassword(getConfigString("password"))
            .setMaxConnections(10)
            .setConnectionTimeout(0);
        return new CouchDbClient(couchProperties);
    }

    public void addStudent(Map<String, Object> student) {
        student.put("_id", student.remove("id"));
        //System.out.println("json = " + student);
        CouchDbClient client = getClient("sv-data");
        client.save(student);
    }

    public void updateStudent(Map<String, Object> student) {
        CouchDbClient client = getClient("sv-data");
        JsonObject old;
        try {
            old = client.find(JsonObject.class, (String)student.get("id"));
            //System.out.println("old = " + old);
            student.put("_id", student.remove("id"));
            student.put("_rev", old.get("_rev").getAsString());
            //System.out.println("student = " + student);
            client.update(student);
        }
        catch (NoDocumentException e) {
            System.out.println("darf nicht passieren " + student.get("id"));
            e.printStackTrace();
        }
    }

    public void updateStudents(List<Map<String, Object>> students) {
        System.out.println();
        Map<String, Map<String, Object>> map = new HashMap<>();
        students.stream().forEach(student -> map.put((String)student.get("id"), student));
        CouchDbClient client = getClient("sv-data");
        try {
            List<Map> docs = client.view("_all_docs")
                .includeDocs(true)
                .keys(new ArrayList<>(map.keySet()))
                .query(Map.class);

            for (Map doc : docs) {
                Map<String, Object> student = map.get(doc.get("_id"));
                student.put("_id", student.remove("id"));
                student.put("_rev", doc.get("_rev"));
            }
            client.bulk(students, false);
        }
        catch (NoDocumentException e) {
            e.printStackTrace();
        }
    }
    public void removeStudent(String student) {
        CouchDbClient client = getClient("sv-data");
        JsonObject old;
        try {
            old = client.find(JsonObject.class, student);
            //System.out.println("old = " + old);
            client.remove(old);
        }
        catch (NoDocumentException e) {
            System.out.println("darf nicht passieren " + student);
            e.printStackTrace();
        }
    }

    public void removeStudents(List<String> students) {
        if (students.isEmpty())
            return;

        CouchDbClient client = getClient("sv-data");
        try {
            List<JsonObject> docs = client.view("_all_docs")
                .includeDocs(true)
                .keys(students)
                .query(JsonObject.class);

            docs.forEach(student -> student.addProperty("_deleted", true));
            client.bulk(docs, false);
        }
        catch (NoDocumentException e) {
            e.printStackTrace();
        }
    }

    public List<String> domain(String domain) {
        View view = getClient("sv-domains").view("domains/byType")
            .key(domain)
            .reduce(false)
            .includeDocs(false);
        return view.query(Map.class).stream().map(map -> (String)map.get("id")).collect(Collectors.toList());
    }

    public void domainAdd(String domain, String id) {
        Map<String, Object> item = new HashMap<>();
        item.put("_id", id);
        item.put("type", domain);
        System.out.println("add " + item);
        CouchDbClient client = getClient("sv-domains");
        client.save(item);
    }

    public void domainRemove(String domain, String id) {
        CouchDbClient client = getClient("sv-domains");
        JsonObject old;
        try {
            old = client.find(JsonObject.class, id);
            client.remove(old);
        }
        catch (NoDocumentException e) {
            System.out.println("darf nicht passieren " + id);
            e.printStackTrace();
        }
    }
}
