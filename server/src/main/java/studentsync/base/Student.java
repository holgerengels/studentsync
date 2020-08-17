package studentsync.base;

import java.io.PrintStream;
import java.sql.Date;
import java.util.ArrayList;
import java.util.List;

/**
 * Created by holger on 19.09.14.
 */
public class Student
    implements Comparable<Student>
{
    public String account;
    public String firstName;
    public String lastName;
    public String gender;
    public Date birthday;
    public String clazz;
    List<String> courses = new ArrayList<String>();

    Student() {
    }

    public Student(String account, String firstName, String lastName, String gender, Date birthday, String clazz) {
        this.account = account;
        this.firstName = firstName;
        this.lastName = lastName;
        this.gender = gender;
        this.birthday = birthday;
        this.clazz = clazz;
    }

    public Student(String account, String firstName, String lastName) {
        this.account = account;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    public static void listStudents(PrintStream output, List<Student> students) {
        for (Student student : students) {
            output.println(student);
        }
    }

    public String getAccount() {
        return account;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getGender() {
        return gender;
    }

    public Date getBirthday() {
        return birthday;
    }

    public String getClazz() {
        return clazz;
    }

    public List<String> getCourses() {
        return courses;
    }

    public void setClazz(String clazz) {
        this.clazz = clazz;
    }

    public void setCourses(List<String> courses) {
        this.courses = courses;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    @Override
    public String toString() {
        return account;
    }

    @Override
    public int compareTo(Student o) {
        return getAccount().compareTo(o.getAccount());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        Student student = (Student)o;

        if (!getAccount().equals(student.getAccount())) return false;

        return true;
    }

    @Override
    public int hashCode() {
        return getAccount().hashCode();
    }

    public static List<Student> filter(List<Student> students, String search) {
        if (search == null || search.length() == 0)
            return students;
        search = search.toLowerCase().trim();

        if (search.startsWith("@")) {
            search = search.substring(1).trim();
            String finalSearch = search;
            students.removeIf(student -> !student.getClazz().toLowerCase().startsWith(finalSearch));
        }
        else {
            String finalSearch = search;
            students.removeIf(student -> !student.getAccount().toLowerCase().startsWith(finalSearch));
        }
        return students;
    }
}
