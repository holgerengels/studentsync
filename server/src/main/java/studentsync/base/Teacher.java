package studentsync.base;

import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Created by holger on 19.09.14.
 */
public class Teacher
    implements Comparable<Teacher>
{
    public String id;
    private String account;
    public String firstName;
    public String lastName;
    public String eMail;
    public String clazz;
    public List<String> functions = new ArrayList<>();
    public List<String> teams = new ArrayList<>();

    public Teacher(String id, String firstName, String lastName, String eMail) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.eMail = eMail;
        this.account = eMail.substring(0, eMail.indexOf('@'));
    }

    public Teacher(String id, String firstName, String lastName) {
        this.id = id;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    public static void listTeachers(PrintStream output, List<Teacher> students) {
        for (Teacher student : students) {
            output.println(student);
        }
    }

    public String getId() {
        return id;
    }

    public String getAccount() {
        return account;
    }

    public String getEMail() {
        return eMail;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getClazz() {
        return clazz;
    }

    public void setClazz(String clazz) {
        this.clazz = clazz;
    }

    public void setId(String id) {
        this.id = id;
    }

    public List<String> getFunctions() {
        return functions;
    }

    public void setFunctions(List<String> functions) {
        this.functions = functions;
    }
    public void addFunction(String function) {
        this.functions.add(function);
    }

    public List<String> getTeams() {
        return teams;
    }

    public void setTeams(List<String> teams) {
        this.teams = teams;
    }
    public void addTeam(String team) {
        this.teams.add(team);
    }

    @Override
    public String toString() {
        return id;
    }

    @Override
    public int compareTo(Teacher o) {
        return getId().compareTo(o.getId());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        Teacher student = (Teacher)o;

        if (!getId().equals(student.getId())) return false;

        return true;
    }

    @Override
    public int hashCode() {
        return getId().hashCode();
    }
}
