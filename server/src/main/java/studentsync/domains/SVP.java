package studentsync.domains;

import com.google.gson.JsonPrimitive;
import org.postgresql.ds.PGPoolingDataSource;
import studentsync.base.*;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Created by holger on 20.12.14.
 */
public class SVP
    extends Domain
{
    private List<Student> students;
    private Map<String, String> classes;
    private Map<String, String> teachers;
    private Map<String, String> religions;
    private Map<String, String> states;
    private Map<String, String> languages;
    private Map<String, String> abgebendeSchulen;
    private List<Choice> studentsReligions;
    private static Map<String, String> genders = new HashMap<>();
    {
        genders.put("m", "männlich");
        genders.put("w", "weiblich");
    }

    public SVP() {
        super("svp");
    }

    public Map<String, String> readClasses() {
        if (classes != null)
            return classes;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");
            String schuljahr = getConfigString("schuljahr");

            classes = new HashMap<>();
            st = con.createStatement();
            rs = st.executeQuery("select id, bezeichnung from klassen where schuljahr_id = (select id from schuljahre where schuljahr = '" + schuljahr + "')");
            while (rs.next()) {
                if (!rs.getString(2).endsWith("-Neu"))
                    classes.put(rs.getString(1), rs.getString(2));
            }
            return this.classes;
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

    public Map<String, String> readTeachers() {
        if (teachers != null)
            return teachers;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");

            teachers = new HashMap<>();
            st = con.createStatement();
            rs = st.executeQuery("select id, name, vorname from lehrer where ehemalig = '0'");
            while (rs.next()) {
                teachers.put(rs.getString(1), rs.getString(2) + ", " + rs.getString(3));
            }
            return this.teachers;
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

    public Map<String, String> readReligions() {
        if (religions != null)
            return religions;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");

            religions = new HashMap<>();
            st = con.createStatement();
            rs = st.executeQuery("select id, name from religionen");
            while (rs.next()) {
                Integer id = rs.getInt(1);
                id += 3000;
                religions.put("" + id, rs.getString(2));
            }
            //System.out.println("religions = " + religions);
            return this.religions;
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
            stop("read religions");
        }
    }

    public Map<String, String> readStates() {
        if (states != null)
            return states;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");

            states = new HashMap<>();
            st = con.createStatement();
            rs = st.executeQuery("select id, land from staaten");
            while (rs.next()) {
                states.put(rs.getString(1), rs.getString(2));
            }
            // System.out.println("states = " + states);
            return this.states;
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
            stop("read states");
        }
    }

    public Map<String, String> readLanguages() {
        if (languages != null)
            return languages;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");

            languages = new HashMap<>();
            st = con.createStatement();
            rs = st.executeQuery("select wl_werteliste_id, wl_kurz_bezeichnung from svn_sd_werteliste where wl_wt_werte_typ_id = 39");
            while (rs.next()) {
                languages.put(rs.getString(1), rs.getString(2));
            }
            // System.out.println("languages = " + languages);
            return this.languages;
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
            stop("read languages");
        }
    }

    public int getFields() {
        return Diff.COMPARE_CLASS | Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME;
    }

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        readClasses();

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");
            String schuljahr = getConfigString("schuljahr");

            st = con.createStatement();
            rs = st.executeQuery("select s.vorname, s.name, s.geschlecht, s.geburtstag, f.benutzerkennung, sik.klasse_id" +
                    "   from schueler s, schueler_eigene_felder f, schueler_in_klassen sik" +
                    "   where s.id = f.schueler_id" +
                    "   and s.id = sik.schueler_id" +
                    "   and sik.klasse_id in (" +
                    "      select id from klassen where schuljahr_id = (" +
                    "         select id from schuljahre where schuljahr = '" + schuljahr + "'" +
                    "      )" +
                    //"      and klassenart_id = 2 or klassenart_id = 7" +
                    "      and klassenart_id = 2" +
                    "   )" +
                    ";");

            HashMap<String, Student> map = new HashMap<String, Student>();
            while (rs.next()) {
                Student student = new Student(rs.getString(5), rs.getString(1), rs.getString(2), rs.getString(3), rs.getDate(4), classes.get(rs.getString(6)));
                map.put(student.getAccount(), student);
            }

            students = new ArrayList<Student>();
            students.addAll(map.values());
            Collections.sort(students);
            return students;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return new ArrayList<Student>();
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

        List<Student> korrekt = new ArrayList<Student>();
        List<Student> aendern = new ArrayList<Student>();
        List<Student> erneuern = new ArrayList<Student>();
        List<Student> hinzu = new ArrayList<Student>();

        start();

        try {
            con = getConnection("svp");
            st = con.createStatement();
            rs = st.executeQuery("SELECT id as id, vorname, name from schueler where id is not null and vorname is not null and name is not null");

            Map<String, Student> map = new HashMap<String, Student>();
            while (rs.next()) {
                Student student = new Student(rs.getString(1), UserIDs.encode(rs.getString(2)), UserIDs.encode(rs.getString(3)));
                //System.out.println(pupil);
                map.put(student.account, student);
            }
            rs.close();
            st.close();

            st = con.createStatement();
            rs = st.executeQuery("SELECT id, schueler_id as schueler, benutzerkennung from schueler_eigene_felder");
            while (rs.next()) {
                Student student = map.get(rs.getString(2));
                if (student == null) {
                    System.err.println("inkonsistenz: " + rs.getString(1));
                    continue;
                }
                map.remove(student.account);

                String kennung = UserIDs.build(len, student.account, student.firstName, student.lastName);
                if (kennung.equals(rs.getString(3))) {
                    korrekt.add(student);
                }
                else {
                    if (rs.getString(3) == null || rs.getString(3).length() == 0)
                        erneuern.add(student);
                    else
                        aendern.add(student);
                }
            }
            rs.close();
            st.close();

            hinzu.addAll(map.values());

            for (Student student : aendern) {
                //System.err.println("build ändern: " + student + ": " + kennung19(student));

                /*
                pst = con.prepareStatement("update schueler_eigene_felder set benutzerkennung = ? where schueler_id = ?");
                pst.setString(1, build(schueler));
                pst.setLong(2, Long.valueOf(schueler.id));
                pst.executeUpdate();
                pst.close();
                */
            }
            for (Student student : erneuern) {
                //System.err.println("build erneuern: " + student + ": " + kennung19(student));

                pst = con.prepareStatement("update schueler_eigene_felder set benutzerkennung = ? where schueler_id = ?");

                pst.setString(1, UserIDs.build(len, student.account, student.firstName, student.lastName));
                pst.setLong(2, Long.valueOf(student.account));
                pst.executeUpdate();
                pst.close();
            }

            st = con.createStatement();
            rs = st.executeQuery("select min(id) from schueler_eigene_felder");
            rs.next();
            long id = Math.min(rs.getLong(1), -1);
            System.err.println("id = " + id);
            rs.close();
            st.close();

            for (Student student : hinzu) {
                //System.err.println("build hinzufügen: " + student + ": " + kennung19(student));
                pst = con.prepareStatement("insert into schueler_eigene_felder (id, schueler_id, benutzerkennung) values (?, ?, ?)");
                pst.setLong(1, --id);
                pst.setLong(2, Long.valueOf(student.account));

                pst.setString(3, UserIDs.build(len, student.account, student.firstName, student.lastName));
                pst.executeUpdate();
                pst.close();

                student.account = UserIDs.build(len, student.account, student.firstName, student.lastName);
            }

            System.out.println("korrekt  = " + korrekt.size());
            System.out.println("aendern  = " + aendern);
            System.out.println("erneuern = " + erneuern);
            System.out.println("hinzu    = " + hinzu);
            return hinzu;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
        }
        finally {
            close(con);
            stop("external ids");
        }
        return null;
    }

    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        SVP svp = new SVP();
        /*
        List<Map<String, Object>> students = svp.loadStudents("zoller.jan9502", "zidi.asm8361");
        for (Map<String, Object> student : students) {
            System.out.println("student = " + student);
        }
        */
        List<Student> students = svp.readStudents();

        for (Student student : students) {
            System.out.println(student.getAccount() + "," + student.getFirstName() +  "," + student.getLastName() + "," + student.getGender() + "," + student.getBirthday());
        }

    }

    public List<String> matchStudents(String search) {
        search = search.toLowerCase();

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");
            String schuljahr = getConfigString("schuljahr");

            st = con.createStatement();
            rs = st.executeQuery("select s.vorname as firstName, s.name as lastName, " +
                " f.benutzerkennung as id, sik.klasse_id as klasse" +
                "   from schueler s, schueler_eigene_felder f, schueler_in_klassen sik" +
                "   where s.id = f.schueler_id" +
                "   and s.id = sik.schueler_id" +
                "   and sik.klasse_id in (" +
                "      select id from klassen where schuljahr_id = (" +
                "         select id from schuljahre where schuljahr = '" + schuljahr + "'" +
                "      )" +
                //"      and klassenart_id = 2 or klassenart_id = 7" +
                "      and klassenart_id = 2" +
                "   )" +
                "   and f.benutzerkennung like '" + search + "%'" +
                "   order by lastName" +
                ";");

            List<String> list = new ArrayList<>();
            while (rs.next())
                list.add(rs.getString("id"));
            return list;
            /*
            Map<String, String> map = new HashMap<>();
            while (rs.next())
                map.put(rs.getString("id"), rs.getString("firstName") + " " + rs.getString("lastName") + " (" + rs.getString("klasse") + ")");
            return map;
            */
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read student");
        }
    }
    public Map<String, Object> loadStudent(String id) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        readClasses();
        readReligions();
        readStates();
        readLanguages();
        //readAbgebendeSchulen();

        start();

        try {
            con = getConnection("svp");
            String schuljahr = getConfigString("schuljahr");

            st = con.createStatement();
            rs = st.executeQuery("select s.vorname as firstName, s.name as lastName, s.geschlecht as gender, s.geburtstag as birthDate, s.sch_geburtsland_id as birthCountry," +
                " s.geburtsname as birthName, s.geburtsort as birthCity, s.strasse as street, s.hausnr as number, s.plz as postcode, s.ort as city," +
                " s.telefon1 as phone, s.telefon3 as phone3, email1 as email," +
                " s.religion_id as religion, s.staat_id as nationality, sl_verkehrssprache_id as language," + // sl_muttersprache_id
                " f.benutzerkennung as id, sik.klasse_id as class, s.schuleintritt_am as eintritt," +
                " s.erz1_id as parent1, s.erz2_id as parent2, " +
                " sik.mittlere_reife_abschluss as vorbildung" +
                "   from schueler s, schueler_eigene_felder f, schueler_in_klassen sik" +
                "   where s.id = f.schueler_id" +
                "   and s.id = sik.schueler_id" +
                "   and sik.klasse_id in (" +
                "      select id from klassen where schuljahr_id = (" +
                "         select id from schuljahre where schuljahr = '" + schuljahr + "'" +
                "      )" +
                "      and klassenart_id = 2" +
                "   )" +
                "   and f.benutzerkennung = '" + id + "'" +
                ";");

            if (rs.next()) {
                Map<String, Object> student = new HashMap<>();
                putString(rs, student, "id", "firstName", "lastName", "birthName", "birthDate", "birthCity", "street", "number", "postcode", "city");
                putString(rs, student, "phone", "phone3", "email");
                student.put("gender", genders.get(rs.getString("gender")));
                student.put("clazz", classes.get(rs.getString("class")));
                student.put("religion", religions.get(rs.getString("religion")));
                student.put("nationality", states.get(rs.getString("nationality")));
                student.put("birthCountry", states.get(rs.getString("birthCountry")));
                student.put("language", languages.get(rs.getString("language")));
                student.put("vorbildung", rs.getString("vorbildung"));
                student = compact(student);
                student.put("parent1", loadParent(rs.getString("parent1")));
                student.put("parent2", loadParent(rs.getString("parent2")));
                return student;
            }

            return null;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read student");
        }
    }
    public List<Map<String, Object>> loadStudents(String... ids) {
        Connection con = null;
        PreparedStatement st = null;
        ResultSet rs = null;

        readClasses();
        readReligions();
        readStates();
        readLanguages();
        //readAbgebendeSchulen();

        start();

        try {
            con = getConnection("svp");
            String schuljahr = getConfigString("schuljahr");

            st = con.prepareStatement("select s.vorname as firstName, s.name as lastName, s.geschlecht as gender, s.geburtstag as birthDate, s.sch_geburtsland_id as birthCountry," +
                " s.geburtsname as birthName, s.geburtsort as birthCity, s.strasse as street, s.hausnr as number, s.plz as postcode, s.ort as city," +
                " s.telefon1 as phone, s.telefon3 as phone3, email1 as email," +
                " s.religion_id as religion, s.staat_id as nationality, sl_verkehrssprache_id as language," + // sl_muttersprache_id
                " f.benutzerkennung as id, sik.klasse_id as class, s.schuleintritt_am as eintritt," +
                " s.erz1_id as parent1, s.erz2_id as parent2, " +
                " sik.mittlere_reife_abschluss as vorbildung" +
                "   from schueler s, schueler_eigene_felder f, schueler_in_klassen sik" +
                "   where s.id = f.schueler_id" +
                "   and s.id = sik.schueler_id" +
                "   and sik.klasse_id in (" +
                "      select id from klassen where schuljahr_id = (" +
                "         select id from schuljahre where schuljahr = ?" +
                "      )" +
                "      and klassenart_id = 2" +
                "   )" +
                "   and f.benutzerkennung = any (?)");

            st.setString(1, schuljahr);
            st.setArray(2, con.createArrayOf("text", ids));
            rs = st.executeQuery();

            List<Map<String, Object>> students = new ArrayList<>();
            List<String> parentIds = new ArrayList<>();
            while (rs.next()) {
                Map<String, Object> student = new HashMap<>();
                putString(rs, student, "id", "firstName", "lastName", "birthName", "birthDate", "birthCity", "street", "number", "postcode", "city");
                putString(rs, student, "phone", "phone3", "email");
                student.put("gender", genders.get(rs.getString("gender")));
                student.put("clazz", classes.get(rs.getString("class")));
                student.put("religion", religions.get(rs.getString("religion")));
                student.put("nationality", states.get(rs.getString("nationality")));
                student.put("birthCountry", states.get(rs.getString("birthCountry")));
                student.put("language", languages.get(rs.getString("language")));
                student.put("vorbildung", rs.getString("vorbildung"));
                student.put("parent1", rs.getString("parent1"));
                student.put("parent2", rs.getString("parent2"));
                student = compact(student);
                students.add(student);
                parentIds.add(rs.getString("parent1"));
                parentIds.add(rs.getString("parent2"));
            }
            Map<String, Map<String, Object>> parents = loadParents(parentIds.toArray(new String[parentIds.size()]));
            for (Map<String, Object> student : students) {
                Map<String, Object> parent1 = parents.get(student.remove("parent1"));
                if (parent1 != null)
                    student.put("parent1", parent1);
                Map<String, Object> parent2 = parents.remove(student.remove("parent2"));
                if (parent2 != null)
                    student.put("parent2", parent2);
            }

            return students;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read students");
        }
    }

    private Map<String, Object> loadParent(String id) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("svp");

            st = con.createStatement();
            rs = st.executeQuery("select e.id, e.vorname as firstName, e.name as lastName," +
                " e.strasse as street, e.hausnr as number, e.plz as postcode, e.ort as city," +
                " e.telefon1 as phone" +
                " from eltern e where e.id = '" + id + "'");

            if (rs.next()) {
                Map<String, Object> parent = new HashMap<>();
                putString(rs, parent, "firstName", "lastName", "street", "number", "postcode", "city", "phone");
                return parent;
            }

            return null;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read parent");
        }
    }

    private Map<String, Map<String, Object>> loadParents(String... ids) {
        Connection con = null;
        PreparedStatement st = null;
        ResultSet rs = null;

        try {
            con = getConnection("svp");

            st = con.prepareStatement("select e.id, e.vorname as firstName, e.name as lastName," +
                " e.strasse as street, e.hausnr as number, e.plz as postcode, e.ort as city," +
                " e.telefon1 as phone" +
                " from eltern e where e.id = any(?)");
            st.setArray(1, con.createArrayOf("bigint", ids));
            rs = st.executeQuery();

            Map<String, Map<String, Object>> parents = new HashMap<>();
            while (rs.next()) {
                Map<String, Object> parent = new HashMap<>();
                putString(rs, parent, "id", "firstName", "lastName", "street", "number", "postcode", "city", "phone");
                parent = compact(parent);
                if (parent.size() > 1)
                    parents.put((String)parent.remove("id"), parent);
            }

            return parents;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
        }
    }

    private Map<String, Object> compact(Map<String, Object> object) {
        for (Iterator<Map.Entry<String, Object>> iterator = object.entrySet().iterator(); iterator.hasNext(); ) {
            Map.Entry<String, Object> entry = iterator.next();
            if (entry.getValue() == null || "".equals(entry.getValue()))
                iterator.remove();
        }
        return object.isEmpty() ? null : object;
    }

    public List<Choice> loadStudentsReligions() {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        readClasses();
        readReligions();

        start();

        try {
            con = getConnection("svp");
            String schuljahr = getConfigString("schuljahr");

            studentsReligions = new ArrayList<>();
            st = con.createStatement();
            rs = st.executeQuery("select f.benutzerkennung, s.religion_id, sik.klasse_id as class" +
                "   from schueler s, schueler_eigene_felder f, schueler_in_klassen sik" +
                "   where s.id = f.schueler_id" +
                "   and s.id = sik.schueler_id" +
                "   and sik.klasse_id in (" +
                "      select id from klassen where schuljahr_id = (" +
                "         select id from schuljahre where schuljahr = '" + schuljahr + "'" +
                "      )" +
                //"      and klassenart_id = 2 or klassenart_id = 7" +
                "      and klassenart_id = 2" +
                "   )" +
                ";");

            while (rs.next()) {
                studentsReligions.add(new Choice(rs.getString(1), classes.get(rs.getString("class")), religions.get(rs.getString(2))));
            }
            //System.out.println("studentsReligions = " + studentsReligions);
            return this.studentsReligions;
        }
        catch (SQLException e) {
            e.printStackTrace();
            Logger.getLogger(SVP.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read students religions");
        }
    }

    private void putString(ResultSet rs, Map<String, Object> student, String... fields) throws SQLException {
        for (String field : fields) {
            student.put(field, rs.getString(field));
        }
    }
    private void putDate(ResultSet rs, Map<String, Object> student, String... fields) throws SQLException {
        for (String field : fields) {
            student.put(field, rs.getDate(field));
        }
    }

    public List<String> domain(String type) {
        Set<String> set = new HashSet<>();
        if ("religion".equals(type))
            set.addAll(readReligions().values());
        else if ("state".equals(type))
            set.addAll(readStates().values());
        else if ("language".equals(type))
            set.addAll(readLanguages().values());
        else if ("class".equals(type))
            set.addAll(readClasses().values());
        else if ("teacher".equals(type))
            set.addAll(readTeachers().values());

        set.remove("");
        List<String> list = new ArrayList<>();
        list.addAll(set);
        Collections.sort(list);
        return list;
    }

    @Override
    protected DataSource createDataSource(String name) {
        PGPoolingDataSource dataSource =  new PGPoolingDataSource();
        dataSource.setDataSourceName("svp");
        dataSource.setServerName(getConfigString("host"));
        dataSource.setPortNumber(Integer.parseInt(getConfigString("port")));
        dataSource.setDatabaseName(getConfigString("name"));
        //dataSource.setUrl(properties.getProperty("svp.url"));
        dataSource.setUser(getConfigString("user"));
        dataSource.setPassword(getConfigString("password"));
        dataSource.setMaxConnections(Integer.parseInt(getConfigString("pool")));
        return dataSource;
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