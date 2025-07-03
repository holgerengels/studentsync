package studentsync.domains;

import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import org.postgresql.ds.PGPoolingDataSource;
import studentsync.base.*;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.*;
import java.sql.Date;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/*
create schema sync authorization asv;
create table sync.user_id (id varchar(40) primary key, userid varchar(25) unique not null);
grant all privileges on sync.user_id to asv;
*/
/**
 * Created by holger on 20.12.14.
 */
public class ASV
    extends Domain
{
    private List<Student> students;
    private List<Teacher> teachers;
    private List<Teacher> classTeachers;
    private Map<String, Map<String,String>> valueLists = new HashMap<>();
    protected Map<String, String> classes;

    public ASV() {
        super("asv");
    }

    public Map<String, String> getValueList(String key) {
        Map<String, String> list = valueLists.get(key);
        if (list != null)
            return list;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");
            st = con.createStatement();
            rs = st.executeQuery("SELECT id from asv.svp_wl_werteliste where bezeichnung = '" + key + "'");

            if (!rs.next())
                throw new RuntimeException("No value list with key " + key);
            String id = rs.getString(1);
            if (rs.next())
                throw new RuntimeException("Multiple value lists with key " + key);

            rs.close();
            st.close();

            st = con.createStatement();
            rs = st.executeQuery("SELECT id, kurzform, langform from asv.svp_wl_wert where werteliste_id = '" + id + "'");
            list = new HashMap<>();
            while (rs.next()) {
                list.put(rs.getString(1), rs.getString(2));
            }
            valueLists.put(key, list);

            return list;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyMap();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read classes");
        }
    }

    protected Map<String, String> readClasses() {
        if (classes != null)
            return classes;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            classes = new HashMap<>();
            st = con.createStatement();
            rs = st.executeQuery("select k.id, k.klassenname" +
                "   from asv.svp_klasse k" +
                "   where k.schule_schuljahr_id in (" +
                "       select ss.id from asv.svp_wl_schuljahr sj, asv.svp_schule_schuljahr ss" +
                "       where sj.id = ss.schuljahr_id and sj.kurzform = '" + schuljahr + "'" +
                "   )" +
                "   and k.wl_klassenart_id in (" +
                "       select id from asv.svp_wl_wert" +
                "       where werteliste_id in (" +
                "           select id from asv.svp_wl_werteliste where bezeichnung = 'KLASSENART'" +
                "       )" +
                "       and kurzform != 'ORG')");
            while (rs.next()) {
                if (!rs.getString(2).contains("-"))
                    classes.put(rs.getString(1), rs.getString(2));
            }
            return this.classes;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyMap();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read classes");
        }
    }

    public List<Teacher> readTeachers() {
        if (teachers != null)
            return teachers;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            teachers = new ArrayList<>();
            st = con.createStatement();
            rs = st.executeQuery("select lss.namenskuerzel, lst.familienname, lst.vornamen, lower(ko.kommunikationsadresse)" +
                    "  from asv.svp_lehrer_schuljahr_schule lss, asv.svp_lehrer_schuljahr ls, asv.svp_lehrer_stamm lst," +
                    "       asv.svp_lehrer_stamm_kommunikation lsk, asv.svp_kommunikation ko" +
                    "  where lss.schule_schuljahr_id in (select ss.id" +
                    "                                  from asv.svp_wl_schuljahr sj," +
                    "                                       asv.svp_schule_schuljahr ss" +
                    "                                  where sj.id = ss.schuljahr_id" +
                    "                                    and sj.kurzform = '" + schuljahr + "')" +
                    "    and lss.lehrer_schuljahr_id = ls.id" +
                    "    and ls.lehrer_stamm_id = lst.id" +
                    "    and lsk.lehrer_stamm_id = ls.lehrer_stamm_id" +
                    "    and lsk.kommunikation_id = ko.id" +
                    "    and ko.wl_kommunikationstyp_id = '1113_EMAIL'" +
                    "  order by lower(ko.kommunikationsadresse);");
            while (rs.next()) {
                String id = rs.getString(1);
                String lastName = rs.getString(2);
                String firstName = rs.getString(3);
                String eMail = rs.getString(4);
                if (eMail == null || !eMail.endsWith("@valckenburgschule.de"))
                    continue;
                Teacher teacher = new Teacher(id, firstName, lastName, eMail);
                teachers.add(teacher);
            }
            Collections.sort(teachers);
            return teachers;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyList();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read teachers");
        }
    }
    public List<Teacher> readClassTeachers() {
        if (classTeachers != null)
            return classTeachers;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            classTeachers = new ArrayList<>();
            st = con.createStatement();
            rs = st.executeQuery("select k.klassenname, lss.namenskuerzel, lst.familienname, lst.vornamen, lower(ko.kommunikationsadresse)" +
                    "  from asv.svp_klassenleitung kl, asv.svp_lehrer_schuljahr_schule lss, asv.svp_klasse k, asv.svp_lehrer_schuljahr ls, asv.svp_lehrer_stamm lst," +
                    "       asv.svp_lehrer_stamm_kommunikation lsk, asv.svp_kommunikation ko" +
                    "  where k.schule_schuljahr_id in (select ss.id" +
                    "                                  from asv.svp_wl_schuljahr sj," +
                    "                                       asv.svp_schule_schuljahr ss" +
                    "                                  where sj.id = ss.schuljahr_id" +
                    "                                    and sj.kurzform = '" + schuljahr + "')" +
                    "    and kl.lehrer_schuljahr_schule_id = lss.id" +
                    "    and lss.lehrer_schuljahr_id = ls.id" +
                    "    and kl.klasse_id = k.id" +
                    "    and ls.lehrer_stamm_id = lst.id" +
                    "    and lsk.lehrer_stamm_id = ls.lehrer_stamm_id" +
                    "    and lsk.kommunikation_id = ko.id" +
                    "    and ko.wl_kommunikationstyp_id = '1113_EMAIL'" +
                    " order by k.klassenname;");
            while (rs.next()) {
                String id = rs.getString(2);
                String lastName = rs.getString(3);
                String firstName = rs.getString(4);
                String eMail = rs.getString(5);
                if (eMail == null || !eMail.endsWith("@valckenburgschule.de"))
                    continue;
                Teacher teacher = new Teacher(id, firstName, lastName, eMail);
                teachers.add(teacher);
            }
            Collections.sort(classTeachers);
            return classTeachers;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyList();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read teachers");
        }
    }

    public List<Teacher> amendWithClass(List<Teacher> teachers) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        Map<String, Teacher> map = teachers.stream().collect(Collectors.toMap(Teacher::getId, teacher -> teacher));
        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            st = con.createStatement();
            rs = st.executeQuery("select k.klassenname, lss.namenskuerzel, lst.familienname, lst.vornamen, lower(ko.kommunikationsadresse)" +
                    "  from asv.svp_klassenleitung kl, asv.svp_lehrer_schuljahr_schule lss, asv.svp_klasse k, asv.svp_lehrer_schuljahr ls, asv.svp_lehrer_stamm lst," +
                    "       asv.svp_lehrer_stamm_kommunikation lsk, asv.svp_kommunikation ko " +
                    "  where k.schule_schuljahr_id in (select ss.id" +
                    "                                  from asv.svp_wl_schuljahr sj," +
                    "                                       asv.svp_schule_schuljahr ss" +
                    "                                  where sj.id = ss.schuljahr_id" +
                    "                                    and sj.kurzform = '" + schuljahr + "')" +
                    "    and kl.lehrer_schuljahr_schule_id = lss.id" +
                    "    and lss.lehrer_schuljahr_id = ls.id" +
                    "    and kl.klasse_id = k.id" +
                    "    and ls.lehrer_stamm_id = lst.id" +
                    "    and lsk.lehrer_stamm_id = ls.lehrer_stamm_id" +
                    "    and lsk.kommunikation_id = ko.id" +
                    "    and ko.wl_kommunikationstyp_id = '1113_EMAIL'" +
                    " order by k.klassenname;");
            while (rs.next()) {
                String id = rs.getString(2);
                String clazz = rs.getString(1);
                Teacher teacher = map.get(id);
                if (teacher != null)
                    teacher.setClazz(clazz);
                else
                    Logger.getLogger(ASV.class.getSimpleName()).log(Level.INFO, "unknown teacher: " + id);
            }

            return teachers;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyList();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("amend teachers with class");
        }
    }

    public List<Teacher> amendWithFunctions(List<Teacher> teachers) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        Map<String, Teacher> map = teachers.stream().collect(Collectors.toMap(Teacher::getId, teacher -> teacher));
        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            st = con.createStatement();
            rs = st.executeQuery("select lss.namenskuerzel, lst.familienname, lst.vornamen, lf.freitext" +
                    " from asv.svp_lehrer_schuljahr_schule lss," +
                    "      asv.svp_lehrer_schuljahr ls," +
                    "      asv.svp_lehrer_stamm lst," +
                    "      asv.svp_freitext_bezeichnung fb," +
                    "      asv.svp_lehrer_freitext lf" +
                    " where lss.schule_schuljahr_id in (select ss.id" +
                    "                                   from asv.svp_wl_schuljahr sj," +
                    "                                        asv.svp_schule_schuljahr ss" +
                    "                                   where sj.id = ss.schuljahr_id" +
                    "                                     and sj.kurzform = '" + schuljahr + "')" +
                    "   and lss.lehrer_schuljahr_id = ls.id" +
                    "   and ls.lehrer_stamm_id = lst.id" +
                    "   and lst.id = lf.lehrer_stamm_id" +
                    "   and lf.freitext_bezeichnung_id = fb.id" +
                    "   and lf.freitext is not null" +
                    "   and fb.bezeichnung = 'Funktion'");
            while (rs.next()) {
                String id = rs.getString(1);
                String function = rs.getString(4);
                Teacher teacher = map.get(id);
                if (teacher != null)
                    teacher.addFunction(function);
                else
                    Logger.getLogger(ASV.class.getSimpleName()).log(Level.INFO, "unknown teacher: " + id);
            }
            return teachers;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyList();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("amend teachers with functions");
        }
    }

    public List<Teacher> amendWithTeams(List<Teacher> teachers) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        Map<String, Teacher> map = teachers.stream().collect(Collectors.toMap(Teacher::getId, teacher -> teacher));
        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            teachers = new ArrayList<>();
            st = con.createStatement();
            rs = st.executeQuery("select lss.namenskuerzel, lst.familienname, lst.vornamen, lf.freitext" +
                    " from asv.svp_lehrer_schuljahr_schule lss," +
                    "      asv.svp_lehrer_schuljahr ls," +
                    "      asv.svp_lehrer_stamm lst," +
                    "      asv.svp_freitext_bezeichnung fb," +
                    "      asv.svp_lehrer_freitext lf" +
                    " where lss.schule_schuljahr_id in (select ss.id" +
                    "                                   from asv.svp_wl_schuljahr sj," +
                    "                                        asv.svp_schule_schuljahr ss" +
                    "                                   where sj.id = ss.schuljahr_id" +
                    "                                     and sj.kurzform = '" + schuljahr + "')" +
                    "   and lss.lehrer_schuljahr_id = ls.id" +
                    "   and ls.lehrer_stamm_id = lst.id" +
                    "   and lst.id = lf.lehrer_stamm_id" +
                    "   and lf.freitext_bezeichnung_id = fb.id" +
                    "   and lf.freitext is not null" +
                    "   and fb.bezeichnung = 'Fachschaft'");
            while (rs.next()) {
                String id = rs.getString(1);
                String function = rs.getString(4);
                Teacher teacher = map.get(id);
                if (teacher != null)
                    teacher.setTeams(Arrays.stream(function.split(",")).map(String::trim).toList());
                else
                    Logger.getLogger(ASV.class.getSimpleName()).log(Level.INFO, "unknown teacher: " + id);
            }
            return teachers;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return Collections.emptyList();
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("amend teachers with teams");
        }
    }

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        Map<String, String> genders = getValueList("GESCHLECHT");
        genders = genders.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().toLowerCase()));
        readClasses();

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            st = con.createStatement();
            rs = st.executeQuery(
                "select u.userid, s.vornamen, s.familienname, s.wl_geschlecht_id, s.geburtsdatum, kg.klasse_id" +
                    "   from asv.svp_schueler_stamm s, sync.user_id u, asv.svp_schueler_schuljahr sj, asv.svp_klassengruppe kg" +
                    "   where s.id in (" +
                    "       select schueler_stamm_id from asv.svp_schueler_schuljahr where schuljahr_id in (" +
                    "           select id from asv.svp_wl_schuljahr where kurzform = '" + schuljahr + "'" +
                    "       )" +
                    "   )" +
                    "   and (s.austrittsdatum is null or s.austrittsdatum > date(now() - INTERVAL '1 month'))" +
                    "   and sj.schueler_stamm_id = s.id" +
                    "   and sj.klassengruppe_id = kg.id" +
                    "   and u.id = s.id" +
                    "   order by u.userid");

            HashMap<String, Student> map = new HashMap<String, Student>();
            while (rs.next()) {
                Student student = new Student(rs.getString(1), rs.getString(2), rs.getString(3), genders.get(rs.getString(4)), rs.getDate(5), classes.get(rs.getString(6)));
                if (student.getClazz() != null)
                    map.put(student.getAccount(), student);
                /*
                else
                    System.out.println("no class " + student);
                 */
            }

            students = new ArrayList<Student>();
            students.addAll(map.values());
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

    public List<Student> generateIds() {
        Connection con = null;
        Statement st = null;
        PreparedStatement pst = null;
        ResultSet rs = null;

        JsonPrimitive maxlength = Configuration.getInstance().getConfig().getAsJsonObject("account").getAsJsonPrimitive("maxlength");
        Integer len = maxlength != null && !maxlength.isJsonNull() ? maxlength.getAsInt() : 18;

        start();

        try {
            con = getConnection("asv");
            st = con.createStatement();
            rs = st.executeQuery("select id, vornamen, familienname from asv.svp_schueler_stamm where id not in (select id from sync.user_id)");
            // Liste von Schülern, zu denen es noch keinen Eintrag in der Tabelle sync.user_id gibt
            List<Student> missing = new ArrayList<>();
            while (rs.next()) {
                missing.add(new Student(rs.getString(1), rs.getString(2), rs.getString(3)));
            }
            rs.close();
            st.close();

            for (Student student : missing) {
                st = con.createStatement();
                // suche nach vorhandenen UserIDs von Schülern mit ähnlichen Namen
                String like = UserIDs.encode(student.lastName);
                if (like.length() > len - 6)
                    like = like.substring(0, len - 6);

                rs = st.executeQuery("select userid from sync.user_id where userid like '" + like + "%'");
                // Liste von UserIDs, die nach der Bildungsvorschrift identisch sind mit der neu zu erzeugenden UserId
                List<String> similar = new ArrayList<>();
                while (rs.next())
                    similar.add(rs.getString(1));

                // Durch Anhängen eines Zählers wird eine eindeutige UserId erzeugt
                String userid = UserIDs.next(len, similar, student.firstName, student.lastName);

                // Speichern der neuen UserId
                pst = con.prepareStatement("insert into sync.user_id (id, userid) values (?, ?)");
                pst.setString(1, student.account);
                pst.setString(2, userid);
                pst.executeUpdate();
                pst.close();

                student.account = userid;
            }
            System.out.println("hinzu    = " + missing.size());
            return missing;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
        }
        finally {
            close(con);
            stop("external ids");
        }
        return null;
    }

    public synchronized Map<String, Date> readExitDates(List<String> students) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");

            st = con.createStatement();
            rs = st.executeQuery(
                    "select u.userid, s.austrittsdatum" +
                            "   from asv.svp_schueler_stamm s, sync.user_id u" +
                            "   where s.austrittsdatum <= date(now())" +
                            "   and u.id = s.id" +
                            "   and u.userid in ('" + String.join("','", students) + "')" +
                            "   order by u.id");

            HashMap<String, Date> map = new HashMap<>();
            while (rs.next()) {
                map.put(rs.getString(1), rs.getDate(2));
            }
            return map;
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

    @Override
    protected DataSource createDataSource(String name) {
        PGPoolingDataSource dataSource =  new PGPoolingDataSource();
        dataSource.setDataSourceName("asv");
        dataSource.setServerName(getConfigString("host"));
        dataSource.setPortNumber(Integer.parseInt(getConfigString("port")));
        dataSource.setDatabaseName(getConfigString("name"));
        //dataSource.setUrl(properties.getProperty("url"));
        dataSource.setUser(getConfigString("user"));
        dataSource.setPassword(getConfigString("password"));
        dataSource.setMaxConnections(Integer.parseInt(getConfigString("pool")));
        return dataSource;
    }

    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        JsonObject config = Configuration.getInstance().getConfig().getAsJsonObject("asv");
        System.out.println("config = " + config);
        Report report = new MailingListsReportTask().execute();
        System.out.println("report = " + report);
        /*
        ASV asv = new ASV();
        List<Teacher> teachers = asv.readTeachers();
        asv.amendWithClass(teachers);
        asv.amendWithFunctions(teachers);
        asv.amendWithTeams(teachers);
        Teacher.listTeachers(System.out, teachers);
        List<Teacher> classTeachers = asv.readClassTeachers();
        System.out.println("classTeachers = " + classTeachers);
        */

        /*
        List<Student> students = asv.readStudents();
        new CSVGenerator().write(new PrintWriter(System.out), students);
        List<String> ids = students.stream()
                //.filter(student -> student.clazz.startsWith("GYM0"))
                .sorted(Comparator.comparing(Student::getClazz).thenComparing(Student::getLastName))
                .map(student -> student.account).collect(Collectors.toList());
        //List<Map<String, Object>> maps = asv.loadStudents(ids.toArray(new String[0]));
        */
    }
}


/*
select vorname, name, schule from schueler s, abgebende_schulen a, schueler_in_klassen sik
where s.abgebende_schule_id = a.id
and s.id = sik.schueler_id
and sik.klasse_id in
(select id from klassen
where schuljahr_id = (select id from schuljahre where schuljahr = '2015/2016')
  and klassenart_id = 2)
 */