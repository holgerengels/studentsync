package studentsync.domains;

import studentsync.base.Choice;

import java.sql.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

public class ASVDomains extends ASV {
    private Map<String, String> religions;
    private Map<String, String> states;
    private Map<String, String> languages;
    private Map<String, String> abgebendeSchulen;
    private List<Choice> studentsReligions;

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
        //else if ("teacher".equals(type))
        //    set.addAll(readTeachers().values());

        set.remove("");
        List<String> list = new ArrayList<>();
        list.addAll(set);
        Collections.sort(list);
        return list;
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
}
