package studentsync.domains;

import com.google.gson.JsonObject;
import org.lightcouch.CouchDbClient;
import org.lightcouch.NoDocumentException;
import org.lightcouch.View;
import studentsync.base.Student;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Created by holger on 28.03.17.
 */
public class Reviews
    extends Bridge
{
    private List<Student> students;

    public Reviews() {
    }

    public synchronized List<Student> readStudents() {
        View view = getClient("review-data").view("data/students")
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

    public List<Student> filterStudents(String search) {
        if (search == null || search.length() == 0)
            return students;
        search = search.toLowerCase().trim();

        if (search.startsWith("!")) {
            search = search.substring(1).trim();
            String state = search;
            return readStudents(state);
        }
        else
            return super.filterStudents(search);
    }

    public List<Student> readStudents(String state) {
        List<Student> students = getClient("review-data").view("data/byState")
            .key(state)
            .reduce(false)
            .includeDocs(true).query(Map.class).stream().map(
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

    public void removeReview(String student) {
        CouchDbClient client = getClient("review-data");
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
}
