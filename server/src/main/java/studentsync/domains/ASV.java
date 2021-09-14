package studentsync.domains;

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
    private Map<String, Map<String,String>> valueLists = new HashMap<>();
    private Map<String, String> classes;
    private Map<String, String> teachers;
    private Map<String, String> religions;
    private Map<String, String> states;
    private Map<String, String> languages;
    private Map<String, String> abgebendeSchulen;
    private List<Choice> studentsReligions;

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

    private Map<String, String> readClasses() {
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
                "       and kurzform ='R')");
            while (rs.next()) {
                if (!rs.getString(2).contains("-"))
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

    private Map<String, String> readTeachers() {
        if (teachers != null)
            return teachers;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");

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

    private Map<String, String> readReligions() {
        if (religions != null)
            return religions;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");

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

    private Map<String, String> readStates() {
        if (states != null)
            return states;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");

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

    private Map<String, String> readLanguages() {
        if (languages != null)
            return languages;

        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        start();

        try {
            con = getConnection("asv");

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

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        Map<String, String> genders = getValueList("GESCHLECHT");
        genders = genders.entrySet().stream().collect(Collectors.toMap(e -> e.getKey(), e -> e.getValue().toLowerCase()));
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
                    "   and (s.austrittsdatum is null or s.austrittsdatum > date(now()))" +
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

    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        ASV asv = new ASV();
        List<Student> students = asv.readStudents();
        List<String> ids = students.stream()
                .filter(student -> student.clazz.startsWith("GYM0"))
                .sorted(Comparator.comparing(Student::getClazz).thenComparing(Student::getLastName))
                .map(student -> student.account).collect(Collectors.toList());
        List<Map<String, Object>> maps = asv.loadStudents(ids.toArray(new String[0]));
        System.out.println("maps = " + maps.get(0));
    }

    public Map<String, Object> loadStudent(String id) {
        Connection con = null;
        Statement st = null;
        ResultSet rs = null;

        Map<String, String> genders = getValueList("GESCHLECHT");
        readClasses();
        readReligions();
        readStates();
        readLanguages();
        //readAbgebendeSchulen();

        start();

        try {
            con = getConnection("asv");
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
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            return null;
        }
        finally {
            close(rs);
            close(st);
            close(con);
            stop("read student");
        }
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

    public List<Map<String, Object>> loadStudents(String... ids) {
        Connection con = null;
        PreparedStatement st = null;
        ResultSet rs = null;

        Map<String, String> genders = getValueList("GESCHLECHT");
        readClasses();
        //readReligions();
        //readStates();
        //readLanguages();
        //readAbgebendeSchulen();

        start();

        try {
            con = getConnection("asv");
            String schuljahr = getConfigString("schuljahr");

            st = con.prepareStatement("select s.vorname as firstName, s.name as lastName, s.geschlecht as gender, s.geburtstag as birthDate, s.sch_geburtsland_id as birthCountry," +
                " s.geburtsname as birthName, s.geburtsort as birthCity, s.strasse as street, s.hausnr as number, s.plz as postcode, s.ort as city," +
                " s.telefon1 as phone, s.telefon3 as phone3, email1 as email," +
                " s.religion_id as religion, s.staat_id as nationality, sl_verkehrssprache_id as language," + // sl_muttersprache_id
                " f.benutzerkennung as id, sik.klasse_id as class, s.schuleintritt_am as eintritt," +
                " s.erz1_id as parent1, s.erz2_id as parent2, " +
                " sik.mittlere_reife_abschluss as vorbildung" +
                "   from svp_schueler_stamm s" +
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
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
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
            con = getConnection("asv");

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
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
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
            con = getConnection("asv");

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
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
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
            con = getConnection("asv");
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
            Logger.getLogger(ASV.class.getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
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