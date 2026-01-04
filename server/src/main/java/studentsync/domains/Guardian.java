package studentsync.domains;

import studentsync.base.Student;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public class Guardian
    implements Comparable
{
    String id;
    String firstName;
    String lastName;
    String eMail;
    final List<Student> students = new ArrayList<>(3);

    public Guardian(String id, String firstName, String lastName, String eMail) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.eMail = eMail;
    }

    public String getId() {
        return id;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getEMail() {
        return eMail;
    }

    public List<Student> getStudents() {
        return students;
    }

    @Override
    public String toString() {
        return eMail;
    }

    @Override
    public int compareTo(Object o) {
        return eMail.compareTo(((Guardian)o).eMail);
    }

    @Override
    public boolean equals(Object obj) {
        return obj instanceof Guardian && ((id != null && id.equals(((Guardian)obj).id)) || (eMail != null && eMail.equals(((Guardian)obj).eMail)));
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, eMail);
    }
}
