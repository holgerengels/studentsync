package studentsync.domains;

import com.mysql.cj.jdbc.MysqlConnectionPoolDataSource;
import studentsync.base.Configuration;
import studentsync.base.ManageableDomain;
import studentsync.base.Student;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.*;
import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.logging.Level;
import java.util.logging.Logger;

import static java.lang.StringTemplate.STR;

/**
 * Created by holger on 20.12.14.
 */
public class Untis
        extends ManageableDomain
{
    private Map<String, String> subjects;
    private Map<String, String> classes;
    private Map<String, List<String>> choices;
    private List<Student> students;
    private HashMap<String, Student> studentsByAccount;
    private HashMap<String, Student> studentById;

    public Untis() {
        super("untis");
    }

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        readSubjects();
        readClasses();
        readChoices();

        start();

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        try {
            con = getConnection("untis");
            st = con.createStatement();

            String schulid = getConfigString("schulid");
            String schuljahr = getConfigString("schuljahr");
            rs = st.executeQuery("SELECT distinct s.STUDENT_ID, s.Name, s.FirstName, s.Longname, s.Flags, s.BirthDate, s.CLASS_ID FROM Student s where s.SCHOOL_ID = '" + schulid + "' and s.SCHOOLYEAR_ID = '" + schuljahr + "';");

            studentsByAccount = new HashMap<String, Student>();
            studentById = new HashMap<String, Student>();
            while (rs.next()) {
                String firstName = rs.getString(3);
                String lastName = rs.getString(4);
                if (rs.getString(2) != null) {
                    String account = rs.getString(2);
                    String gender = toGender(rs.getString(5));
                    Date birthday = toDate(rs.getString(6));
                    String clazz = classes.get(rs.getString(7));
                    Student pupil = new Student(account, firstName, lastName, gender, birthday, clazz);
                    List<String> courses = choices.get(rs.getString(1));
                    pupil.setCourses(courses);
                    studentsByAccount.put(pupil.getAccount(), pupil);
                    studentById.put(rs.getString(1), pupil);
                }
                else {
                    System.out.print("WARN: " + firstName + " " + lastName + " has null account!");
                }
            }

            students = new ArrayList<>();
            students.addAll(studentsByAccount.values());
            Collections.sort(students);
            return students;
        }
        catch (SQLException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read students");
        }
    }

    private String toGender(String string) {
        if (string == null)
            return null;
        else if (string.contains("M"))
            return "m";
        else if (string.contains("W"))
            return "w";
        else
            return null;
    }

    private String fromGender(String string) {
        if (string == null)
            return null;
        else if (string.equals("m"))
            return "M";
        else if (string.equals("w"))
            return "W";
        else
            return null;
    }

    DateFormat dateFormat = new SimpleDateFormat("yyyyMMdd");

    private Date toDate(String string) {
        if (string != null && !"0".equals(string)) {
            try {
                return new Date(dateFormat.parse(string).getTime());
            }
            catch (ParseException e) {
                e.printStackTrace();
                return null;
            }
        }
        else
            return null;
    }

    private String fromDate(Date date) {
        if (date != null) {
            return dateFormat.format(date);
        }
        else
            return null;
    }

    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        Untis untis = new Untis();
        untis.teacherExternalIds();
        /*
        System.out.println("students = " + untis.readStudents());
        System.out.println("subjects = " + untis.readSubjects());
        Map<String, List<String>> map = untis.readChoices();
        System.out.println("untis.readChoices() = " + map);
        Map<String, List<String>> courses = untis.courseList(map);
        untis.printCourseList(courses);
         */
    }

    private void printCourseList(Map<String, List<String>> courses) {
        courses = new TreeMap<>(courses);
        for (Map.Entry<String, List<String>> entry : courses.entrySet()) {
            System.out.print(entry.getKey());
            System.out.print(": ");
            for (String member : entry.getValue()) {
                Student student = studentById.get(member);
                System.out.print(student.getAccount());
                System.out.print(";");
            }
            System.out.println();
        }
    }

    private Map<String, List<String>> courseList(Map<String, List<String>> map) {
        Map<String, List<String>> courses = new HashMap<String, List<String>>();
        for (Map.Entry<String, List<String>> entry : map.entrySet()) {
            for (String course : entry.getValue()) {
                List<String> members = courses.get(course);
                if (members == null) {
                    members = new ArrayList<String>();
                    courses.put(course, members);
                }
                members.add(entry.getKey());
            }
        }
        return courses;
    }

    private Map<String, String> filterSubjects(Map<String, String> subjects) {
        Map<String, String> filtered = new HashMap<>(subjects);
        for (Iterator<Map.Entry<String, String>> iterator = filtered.entrySet().iterator(); iterator.hasNext(); ) {
            Map.Entry<String, String> entry = iterator.next();
            if (!entry.getValue().startsWith("BINF")
                    && !entry.getValue().startsWith("INF")
                    && !entry.getValue().startsWith("BPK-DV")
                    && !entry.getValue().startsWith("BPK-TV")
            )
                iterator.remove();
        }
        return filtered;
    }

    public Map<String, String> readSubjects() {
        if (subjects != null)
            return subjects;

        start();

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        try {
            con = getConnection("untis");
            st = con.createStatement();

            String schulid = getConfigString("schulid");
            String schuljahr = getConfigString("schuljahr");
            rs = st.executeQuery("SELECT SUBJECT_ID, Name FROM Subjects where SCHOOL_ID = '" + schulid + "' AND SCHOOLYEAR_ID = '" + schuljahr + "'");

            subjects = new HashMap<String, String>();
            while (rs.next()) {
                String id = rs.getString(1);
                String name = rs.getString(2);
                subjects.put(id, name);
            }
            return subjects;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(Untis.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyMap();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read subjects");
        }
    }

    public Map<String, String> readClasses() {
        if (classes != null)
            return classes;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("untis");
            st = con.createStatement();

            String schulid = getConfigString("schulid");
            String schuljahr = getConfigString("schuljahr");
            rs = st.executeQuery(STR . "SELECT CLASS_ID, Name FROM Class where SCHOOL_ID = '\{schulid}' AND SCHOOLYEAR_ID = '\{schuljahr}' ORDER BY TERM_ID");

            classes = new HashMap<>();
            while (rs.next()) {
                String id = rs.getString(1);
                String name = rs.getString(2);
                classes.put(id, name);
            }
            return classes;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(Untis.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyMap();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read classes");
        }
    }

    public Map<String, List<String>> readChoices() {
        if (choices != null)
            return choices;

        Map<String, String> subjects = filterSubjects(readSubjects());

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("untis");
            st = con.createStatement();

            String schulid = getConfigString("schulid");
            String schuljahr = getConfigString("schuljahr");
            rs = st.executeQuery("SELECT c.STUDENT_ID, c.AlternativeCourses FROM StudentChoice c WHERE c.SCHOOL_ID = '" + schulid + "' AND c.SCHOOLYEAR_ID = '" + schuljahr + "'");

            choices = new HashMap<>();
            while (rs.next()) {
                String userid = rs.getString(1);
                String string = rs.getString(2);
                if (string == null) {
                    System.out.println(userid + ": string is null");
                    string = "";
                }
                else if (!string.contains("/")) {
                    System.out.println(userid + ": string without /");
                    string = "";
                }
                else {
                    String course = string.split("/")[1];
                    List<String> courses = choices.get(userid);
                    String subject = subjects.get(course);
                    if (subject != null) {
                        if (courses == null)
                            choices.put(userid, courses = new ArrayList<String>());
                        if (!courses.contains(subject))
                            courses.add(subject);
                    }
                }
            }
            return choices;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(Untis.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyMap();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read choices");
        }
    }

    public int studentExternalIds() {
        Connection con = null;
        Statement st = null;

        start();

        try {
            con = getConnection("untis");
            st = con.createStatement();

            return st.executeUpdate("UPDATE Student SET ForeignKey = Name WHERE ForeignKey IS NULL OR ForeignKey != Name");
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(Untis.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return -1;
        }
        finally {
            close(st);
            close(con);
            stop("external ids");
        }
    }

    public int teacherExternalIds() {
        Connection con = null;
        Statement st = null;

        start();

        try {
            con = getConnection("untis");
            st = con.createStatement();

            return st.executeUpdate("update Teacher set foreignkey = left(email, length(email) - 21) where email like '%valckenburgschule.de' and foreignkey != left(email, length(email) - 21)");
        }
        catch (SQLException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            close(st);
            close(con);
            stop("external ids");
        }
    }

    public Map<String, String> readTeachers() {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();
        try {
            con = getConnection("untis");
            st = con.createStatement();

            String schulid = getConfigString("schulid");
            String schuljahr = getConfigString("schuljahr");
            rs = st.executeQuery("SELECT Name, Email FROM Teacher where SCHOOL_ID = '" + schulid + "' AND SCHOOLYEAR_ID = '" + schuljahr + "'");

            HashMap<String, String> map = new HashMap<String, String>();
            while (rs.next()) {
                String name = rs.getString(1);
                String email = rs.getString(2);
                if (email == null)
                    continue;

                int pos = email.indexOf('@');
                if (pos != -1) {
                    String user = email.substring(0, pos);
                    map.put(name, user);
                }
            }
            return map;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(Untis.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyMap();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read teachers");
        }
    }

    @Override
    public void addStudent(Student student) {
    }

    @Override
    public void removeStudent(Student student) {
    }

    @Override
    public void changeStudent(Student student) {
        Connection con = null;
        PreparedStatement pst = null;

        try {
            String schulid = getConfigString("schulid");
            con = getConnection("untis");
            pst = con.prepareStatement("update Student s set s.FirstName = ?, s.Longname = ?, s.Flags = ?, s.BirthDate = ? where s.SCHOOL_ID = '" + schulid + "' AND s.Name = ?");
            pst.setString(1, student.getFirstName());
            pst.setString(2, student.getLastName());
            pst.setString(3, fromGender(student.getGender()));
            pst.setString(4, fromDate(student.getBirthday()));
            pst.setString(5, student.getAccount());
            pst.executeUpdate();
            pst.close();
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(Untis.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
        }
        finally {
            close(pst);
            close(con);
        }
    }

    @Override
    protected DataSource createDataSource(String name) {
        //Class.forName(properties.getProperty("svp.driver"));
        MysqlConnectionPoolDataSource dataSource = new MysqlConnectionPoolDataSource();
        dataSource.setDatabaseName(getConfigString("name"));
        dataSource.setServerName(getConfigString("host"));
        dataSource.setPort(Integer.parseInt(getConfigString("port")));
        dataSource.setUser(getConfigString("user"));
        dataSource.setPassword(getConfigString("password"));
        try {
            dataSource.setServerTimezone(getConfigString("timezone"));
        }
        catch (SQLException e) {
            throw new RuntimeException(e);
        }
        return dataSource;
    }
}