package studentsync.domains;

import studentsync.base.Diff;
import studentsync.base.Student;

import javax.json.*;
import java.sql.Date;
import java.util.List;

/**
 * Created by holger on 25.03.17.
 */
public class JSON
{
    private static JsonObject json(Integer number) {
        JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
        objectBuilder.add("changed", number);
        return objectBuilder.build();
    }

    protected static JsonArray json(List<Student> list) {
        JsonArrayBuilder builder = Json.createArrayBuilder();
        for (Student student : list) {
            builder.add(json(student));
        }
        return builder.build();
    }

    protected static JsonArray json(Diff diff) {
        JsonArrayBuilder builder = Json.createArrayBuilder();
        if (diff.getAdded() != null) {
            for (Student student : diff.getAdded()) {
                builder.add(json("added", student));
            }
        }
        if (diff.getRemoved() != null) {
            for (Student student : diff.getRemoved()) {
                builder.add(json("removed", student));
            }
        }
        if (diff.getChanged() != null) {
            for (Diff.Change change : diff.getChanged()) {
                builder.add(json(change));
            }
        }
        if (diff.getKept() != null) {
            JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
            objectBuilder.add("change", "kept");
            objectBuilder.add("kept", diff.getKept().size());
            builder.add(objectBuilder.build());
        }
        return builder.build();
    }

    private static JsonObject json(Student student) {
        JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
        objectBuilder.add("account", student.getAccount());

        if (student.getFirstName() != null)
            objectBuilder.add("firstName", student.getFirstName());
        if (student.getLastName() != null)
            objectBuilder.add("lastName", student.getLastName());
        if (student.getGender() != null)
            objectBuilder.add("gender", student.getGender());
        if (student.getBirthday() != null)
            objectBuilder.add("birthday", format(student.getBirthday()));
        if (student.getClazz() != null)
            objectBuilder.add("clazz", student.getClazz());
        return objectBuilder.build();
    }

    private static JsonObject json(String change, Student student) {
        JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
        objectBuilder.add("change", change);
        objectBuilder.add("account", student.getAccount());

        if (student.getFirstName() != null)
            objectBuilder.add("firstName", student.getFirstName());
        if (student.getLastName() != null)
            objectBuilder.add("lastName", student.getLastName());
        if (student.getGender() != null)
            objectBuilder.add("gender", student.getGender());
        if (student.getBirthday() != null)
            objectBuilder.add("birthday", format(student.getBirthday()));
        if (student.getClazz() != null)
            objectBuilder.add("clazz", student.getClazz());
        return objectBuilder.build();
    }

    private static JsonObject json(Diff.Change change) {
        JsonObjectBuilder objectBuilder = Json.createObjectBuilder();
        objectBuilder.add("change", "changed");
        objectBuilder.add("account", change.getAccount());

        if (change.getFirstName() != null)
            objectBuilder.add("firstName", change.getFirstName());
        if (change.getLastName() != null)
            objectBuilder.add("lastName", change.getLastName());
        if (change.getGender() != null)
            objectBuilder.add("gender", change.getGender());
        if (change.getBirthday() != null)
            objectBuilder.add("birthday", format(change.getBirthday()));
        if (change.getClazz() != null)
            objectBuilder.add("clazz", change.getClazz());

        if (change.getFirstNameE() != null)
            objectBuilder.add("firstNameE", change.getFirstNameE());
        if (change.getLastNameE() != null)
            objectBuilder.add("lastNameE", change.getLastNameE());
        if (change.getGenderE() != null)
            objectBuilder.add("genderE", change.getGenderE());
        if (change.getBirthdayE() != null)
            objectBuilder.add("birthdayE", format(change.getBirthdayE()));
        if (change.getClazzE() != null)
            objectBuilder.add("clazzE", change.getClazzE());

        return objectBuilder.build();
    }

    private static String format(Date birthday) {
        return "" + birthday;
    }
}
