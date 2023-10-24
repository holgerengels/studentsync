package studentsync.domains;

import studentsync.base.*;

import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.*;
import javax.naming.ldap.Control;
import javax.naming.ldap.InitialLdapContext;
import javax.naming.ldap.LdapContext;
import javax.naming.ldap.PagedResultsControl;
import javax.naming.ldap.PagedResultsResponseControl;
import javax.sql.DataSource;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Created by holger on 20.12.14.
 */
public class PaedML
    extends ManageableDomain
{
    private final String schuljahr;
    private String MEMBER_OF_CLASS = "CN=G_Schueler_VBS_";
    private String MEMBER_OF_OCTO = "CN=OCTO_VBS_";
    private String MEMBER_OF_PROJECT = "CN=G_Projekte_";
    private List<Student> students;

    ThreadLocal<LdapContext> ldapContext = ThreadLocal.withInitial(() -> {
        try {
            //ExtendedTrustManager.getInstance(Configuration.getInstance().getConfig());

            System.out.println("PaedML: establishing connection");
            Hashtable<String, String> env = new Hashtable<String, String>();
            env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
            env.put("java.naming.ldap.version", "3");
            env.put(Context.PROVIDER_URL, getConfigString("url"));
            env.put(Context.SECURITY_PRINCIPAL, getConfigString("user"));
            env.put(Context.SECURITY_CREDENTIALS, getConfigString("password"));
            env.put(Context.SECURITY_AUTHENTICATION, "simple");

            return new InitialLdapContext(env, null);
        }
        catch (NamingException e) {
            throw new RuntimeException(e);
        }
    });

    public void release() {
        System.out.println("PaedML: closing connection");
        ldapContext.remove();
    }

    public PaedML() {
        super("ldap");
        schuljahr = getConfigString("schuljahr");
    }

    @Override
    public int getFields() {
        return Diff.COMPARE_CLASS | Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME;
    }

    @Override
    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        start();
        LdapContext context = null;
        try {
            context = ldapContext.get();
            context.setRequestControls(new Control[]{ new PagedResultsControl(100, false) });
            String searchFilter = "(&(objectClass=User))";

            SearchControls searchControls = new SearchControls();
            String[] resultAttributes = { "cn", "sn", "givenName", "memberof", "department" };
            searchControls.setReturningAttributes(resultAttributes);
            searchControls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            searchControls.setCountLimit(2000);

            students = new ArrayList<Student>();

            byte[] b = null;
            do {
                NamingEnumeration results = context.search(getConfigString("studentUserbase"), searchFilter, searchControls);

                if (results != null) {
                    int subcounter = 0;
                    while (results.hasMoreElements()) {
                        SearchResult searchResult = (SearchResult)results.nextElement();
                        Attributes attributes = searchResult.getAttributes();
                        //System.out.println("attributes = " + attributes);
                        String cn = attribute(attributes, "cn");
                        String givenname = attribute(attributes, "givenname");
                        String sn = attribute(attributes, "sn");
                        String department = attribute(attributes, "department");
                        if (cn == null || givenname == null || sn == null || department == null)
                            continue;
                        List<String> groups = groups(attributes);
                        Student student = new Student(cn.toLowerCase(), givenname, sn, null, null, department.toUpperCase());
                        if (groups.size() > 1) {
                            groups.remove(0);
                            student.setCourses(groups);
                        }
                        students.add(student);
                    }
                }
                else
                    System.out.println("did not match with any!!!");

                b = ((PagedResultsResponseControl)context.getResponseControls()[0]).getCookie();

                if (b != null) {
                    System.out.println("--------NEW PAGE----------");
                    context.setRequestControls(new Control[]{ new PagedResultsControl(100, b, Control.CRITICAL) });
                }

            } while (b != null);

            Collections.sort(students);
            return students;
        }
        catch (NamingException | IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            stop("read students");
        }
    }

    @Override
    protected DataSource createDataSource(String name) {
        return null;
    }

    private String attribute(Attributes attributes, String id) throws NamingException {
        Attribute attribute = attributes.get(id);
        return attribute != null ? (String) attribute.get() : null;
    }

    private String group(Attributes attributes) throws NamingException {
        String memberof = (String) attributes.get("memberof").get();
        int index = memberof.indexOf(',');
        return memberof.substring(5, index);
    }

    private List<String> groups(Attributes attributes) throws NamingException {
        List<String> courses = new ArrayList<String>();
        Attribute attribute = attributes.get("memberof");
        if (attribute == null)
            return courses;

        NamingEnumeration<?> enumeration = attribute.getAll();
        while (enumeration.hasMoreElements()) {
            int type = 0;
            String group = (String)enumeration.nextElement();
            if (group.startsWith(MEMBER_OF_CLASS)) {
                type = 1;
                group = group.substring(MEMBER_OF_CLASS.length(), group.indexOf(',', MEMBER_OF_CLASS.length()));
            }
            if (group.startsWith(MEMBER_OF_PROJECT)) {
                type = 2;
                group = group.substring(MEMBER_OF_PROJECT.length(), group.indexOf(',', MEMBER_OF_PROJECT.length()));
            }
            if (group.endsWith(schuljahr))
                group = group.substring(0, group.length() - schuljahr.length() - 1);
            if (group.endsWith("_Mitglieder"))
                group = group.substring(0, group.length() - "Mitglieder".length() - 1);

            if (type == 1)
                courses.add(0, group.toUpperCase());
            else if (type == 2)
                courses.add(group);
        }
        return courses;
    }

    public void storeImage(String userid, byte[] photo) {
        String dn = studentDn(userid);

        try {
            LdapContext context = this.ldapContext.get();
            context.modifyAttributes(dn, new ModificationItem[] {
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("thumbnailPhoto", photo))
            });
        }
        catch (NamingException e) {
            e.printStackTrace();
        }
    }

    public boolean authenticate(String user, String password) {
        System.out.println(user);
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        env.put("java.naming.ldap.version", "3");
        env.put(Context.PROVIDER_URL, getConfigString("url"));
        env.put(Context.SECURITY_PRINCIPAL, user + "@" + getConfigString("domain"));
        env.put(Context.SECURITY_CREDENTIALS, password);
        env.put(Context.SECURITY_AUTHENTICATION, "simple");

        try {
            new InitialLdapContext(env, null);
            return true;
        }
        catch (NamingException e) {
		e.printStackTrace();
            return false;
        }
    }

    int UF_SCRIPT = 0x0001;
    int UF_ACCOUNTDISABLE = 0x0002;
    int UF_PASSWD_NOTREQD = 0x0020;
    int UF_PASSWD_CANT_CHANGE = 0x0040;
    int UF_NORMAL_ACCOUNT = 0x0200;
    int UF_DONT_EXPIRE_PASSWD = 0x10000;
    int UF_PASSWORD_EXPIRED = 0x800000;

    @Override
    public void addStudent(Student student) {
        Attribute objClasses = new BasicAttribute("objectClass");
        objClasses.add("top");
        objClasses.add("person");
        objClasses.add("organizationalPerson");
        objClasses.add("user");

        Attribute employeeType = new BasicAttribute("employeeType", "Student");
        Attribute department = new BasicAttribute("department", student.clazz.toLowerCase());
        Attribute company = new BasicAttribute("company", getConfigString("schoolType"));
        Attribute division = new BasicAttribute("division");
        division.add(getConfigString("schoolTypeAbbrev"));
        Attribute businessCategory = new BasicAttribute("businessCategory");
        businessCategory.add(getConfigString("schoolTypeAbbrev"));
        Attribute sAMAccountName = new BasicAttribute("sAMAccountName", student.account);
        Attribute givenName = new BasicAttribute("givenName", student.firstName);
        Attribute sn = new BasicAttribute("sn", student.lastName);
        Attribute displayName = new BasicAttribute("displayName", student.firstName + " " + student.lastName);
        Attribute userPrincipalName = new BasicAttribute("userPrincipalName", student.account + "@musterschule.schule.paedml");
        Attribute profilePath = new BasicAttribute("profilePath", "\\\\sp01\\Serverprofile$\\Benutzerprofile\\Schueler\\" + getConfigString("schoolTypeAbbrev"));
        Attribute departmentNumber = new BasicAttribute("departmentNumber");
        departmentNumber.add(schuljahr);

        Attributes container = new BasicAttributes();
        container.put(objClasses);
        container.put(employeeType);
        container.put(department);
        container.put(company);
        container.put(division);
        container.put(businessCategory);
        container.put(sAMAccountName);
        container.put(givenName);
        container.put(sn);
        container.put(displayName);
        container.put(userPrincipalName);
        container.put(profilePath);
        container.put(departmentNumber);

        LdapContext context = null;
        try {
            context = ldapContext.get();
            String dn = studentDn(student.account);
            context.createSubcontext(dn, container);
            System.out.println("student created");

            String newQuotedPassword = "\"" + getConfigString("initialPassword") + "\"";
            byte[] newUnicodePassword = newQuotedPassword.getBytes(StandardCharsets.UTF_16LE);
            context.modifyAttributes(dn, new ModificationItem[] {
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("unicodePwd", newUnicodePassword)),
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("userAccountControl", Integer.toString(UF_NORMAL_ACCOUNT + UF_PASSWD_NOTREQD))),
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("pwdLastSet", Integer.toString(0)))
            });
            System.out.println("password set");
        }
        catch (Exception e) {
            e.printStackTrace();
        }
        finally {
            /*
            try {
                context.close();
            }
            catch (NamingException e) {
                e.printStackTrace();
            }
            */
        }
    }

    @Override
    public void removeStudent(Student student) {
        try {
            LdapContext context = ldapContext.get();
            String dn = studentDn(student.account);
            context.destroySubcontext(dn);
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void changeStudent(Student student) {
        try {
            LdapContext context = ldapContext.get();
            String dn = studentDn(student.getAccount());
            context.modifyAttributes(dn, new ModificationItem[] {
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("givenName", student.getFirstName())),
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("sn", student.getLastName())),
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("displayName", student.getFirstName() + " " + student.getLastName())),
                new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("department", student.getClazz().toLowerCase()))
            });
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }

    public synchronized List<Student> studentsWithGroupsMissing() {
        LdapContext context = null;
        try {
            context = ldapContext.get();
            context.setRequestControls(new Control[]{ new PagedResultsControl(100, false) });
            String searchFilter = "(&(objectClass=User))";

            SearchControls searchControls = new SearchControls();
            String[] resultAttributes = { "cn", "sn", "givenName", "memberof", "department" };
            searchControls.setReturningAttributes(resultAttributes);
            searchControls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            searchControls.setCountLimit(2000);

            List<Student> students = new ArrayList<Student>();

            byte[] b = null;
            do {
                NamingEnumeration results = context.search(getConfigString("studentUserbase"), searchFilter, searchControls);

                if (results != null) {
                    int subcounter = 0;
                    while (results.hasMoreElements()) {
                        SearchResult searchResult = (SearchResult) results.nextElement();
                        Attributes attributes = searchResult.getAttributes();
                        //System.out.println("attributes = " + attributes);
                        String cn = attribute(attributes, "cn");
                        String givenname = attribute(attributes, "givenname");
                        String sn = attribute(attributes, "sn");
                        String department = attribute(attributes, "department");
                        if (cn == null || givenname == null || sn == null || department == null)
                            continue;

                        List<String> required = new ArrayList<>(Arrays.asList(
                                "CN=G_Schueler,OU=Active Directory,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml",
                                "CN=G_Schueler_VBS,OU=FileShare,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml",
                                "CN=G_Schueler_VBS_" + department + "_" + schuljahr + ",OU=FileShare,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml"));
                        List<String> present = new ArrayList<>(4);
                        Attribute attribute = attributes.get("memberof");
                        if (attribute != null) {
                            NamingEnumeration<?> enumeration = attribute.getAll();
                            while (enumeration.hasMoreElements()) {
                                String value = (String) enumeration.nextElement();
                                present.add(value);
                            }
                        }
                        required.removeAll(present);
                        if (!present.contains("CN=OCTO_VBS_" + department + ",OU=Firewall,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml")
                                && !present.contains("CN=OCTO_VBS_" + department.toUpperCase() + ",OU=Firewall,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml"))
                            required.add("CN=OCTO_VBS_" + department + ",OU=Firewall,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml");
                        if (!required.isEmpty()) {
                            Student student = new Student(cn.toLowerCase(), givenname, sn, null, null, department);
                            student.setCourses(required);
                            students.add(student);
                        }
                    }
                }
                else
                    System.out.println("did not match with any!!!");

                b = ((PagedResultsResponseControl)context.getResponseControls()[0]).getCookie();

                if (b != null) {
                    System.out.println("--------NEW PAGE----------");
                    context.setRequestControls(new Control[]{ new PagedResultsControl(100, b, Control.CRITICAL) });
                }

            } while (b != null);

            Collections.sort(students);
            return students;
        }
        catch (NamingException | IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
        }
    }

    public void fixStudentsGroups(Student student) {
        LdapContext context = ldapContext.get();
        String dn = studentDn(student.getAccount());

        student.getCourses().forEach(course -> {
            try {
                context.modifyAttributes(course, new ModificationItem[] { new ModificationItem(DirContext.ADD_ATTRIBUTE, new BasicAttribute("member", dn)) });
            }
            catch (NamingException e) {
                e.printStackTrace();
            }
        });
    }

    public synchronized List<Student> studentsWithEMailMissing() {
        LdapContext context = null;
        try {
            context = ldapContext.get();
            context.setRequestControls(new Control[]{ new PagedResultsControl(100, false) });
            String searchFilter = "(&(objectClass=User))";

            SearchControls searchControls = new SearchControls();
            String[] resultAttributes = { "cn", "sn", "givenName", "memberof", "department", "mail" };
            searchControls.setReturningAttributes(resultAttributes);
            searchControls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            searchControls.setCountLimit(2000);

            List<Student> students = new ArrayList<Student>();

            byte[] b = null;
            do {
                NamingEnumeration results = context.search(getConfigString("studentUserbase"), searchFilter, searchControls);

                if (results != null) {
                    int subcounter = 0;
                    while (results.hasMoreElements()) {
                        SearchResult searchResult = (SearchResult) results.nextElement();
                        Attributes attributes = searchResult.getAttributes();
                        //System.out.println("attributes = " + attributes);
                        String cn = attribute(attributes, "cn");
                        String givenname = attribute(attributes, "givenname");
                        String sn = attribute(attributes, "sn");
                        String department = attribute(attributes, "department");
                        String email = attribute(attributes, "mail");
                        if (cn == null || givenname == null || sn == null || department == null)
                            continue;

                        if (email == null) {
                            Student student = new Student(cn.toLowerCase(), givenname, sn, null, null, department);
                            student.setEMail("schueler@valckenburgschule.de");
                            students.add(student);
                        }
                    }
                }
                else
                    System.out.println("did not match with any!!!");

                b = ((PagedResultsResponseControl)context.getResponseControls()[0]).getCookie();

                if (b != null) {
                    System.out.println("--------NEW PAGE----------");
                    context.setRequestControls(new Control[]{ new PagedResultsControl(100, b, Control.CRITICAL) });
                }

            } while (b != null);

            Collections.sort(students);
            return students;
        }
        catch (NamingException | IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
        }
    }

    public synchronized List<Student> teachersWithoutEMail() {
        LdapContext context = null;
        try {
            context = ldapContext.get();
            context.setRequestControls(new Control[]{ new PagedResultsControl(100, false) });
            String searchFilter = "(&(objectClass=User))";

            SearchControls searchControls = new SearchControls();
            String[] resultAttributes = { "cn", "sn", "givenName", "memberof", "department", "mail" };
            searchControls.setReturningAttributes(resultAttributes);
            searchControls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            searchControls.setCountLimit(2000);

            List<Student> students = new ArrayList<Student>();

            byte[] b = null;
            do {
                NamingEnumeration<SearchResult> results = context.search(getConfigString("teacherUserbase"), searchFilter, searchControls);

                if (results != null) {
                    int subcounter = 0;
                    while (results.hasMoreElements()) {
                        SearchResult searchResult = results.nextElement();
                        Attributes attributes = searchResult.getAttributes();
                        //System.out.println("attributes = " + attributes);
                        String cn = attribute(attributes, "cn");
                        String givenname = attribute(attributes, "givenname");
                        String sn = attribute(attributes, "sn");
                        String email = attribute(attributes, "mail");
                        if (cn == null || givenname == null || sn == null)
                            continue;

                        if (email == null || email.length() == 0) {
                            Student student = new Student(cn.toLowerCase(), givenname, sn, null, null, null);
                            students.add(student);
                        }
                    }
                }
                else
                    System.out.println("did not match with any!!!");

                b = ((PagedResultsResponseControl)context.getResponseControls()[0]).getCookie();

                if (b != null) {
                    System.out.println("--------NEW PAGE----------");
                    context.setRequestControls(new Control[]{ new PagedResultsControl(100, b, Control.CRITICAL) });
                }

            } while (b != null);

            Collections.sort(students);
            return students;
        }
        catch (NamingException | IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
        }
    }

    public void fixStudentsEMail(Student student) {
        LdapContext context = ldapContext.get();
        String dn = studentDn(student.getAccount());
        try {
            context.modifyAttributes(dn, new ModificationItem[] { new ModificationItem(DirContext.ADD_ATTRIBUTE, new BasicAttribute("mail", student.getEMail())) });
        }
        catch (NamingException e) {
            e.printStackTrace();
        }
    }

    public void addTeacherEMail(Student student) {
        LdapContext context = ldapContext.get();
        String dn = teacherDn(student.getAccount());
        try {
            context.modifyAttributes(dn, new ModificationItem[] { new ModificationItem(DirContext.ADD_ATTRIBUTE, new BasicAttribute("mail", student.account + "@valckenburgschule.de")) });
        }
        catch (NamingException e) {
            e.printStackTrace();
        }
    }

    public void fixPasswordSettings(Student student) {
        LdapContext context = ldapContext.get();
        String dn = studentDn(student.getAccount());
        try {
            context.modifyAttributes(dn, new ModificationItem[] {
                    new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("userAccountControl", Integer.toString(UF_NORMAL_ACCOUNT + UF_PASSWD_NOTREQD))),
                    new ModificationItem(DirContext.REPLACE_ATTRIBUTE, new BasicAttribute("pwdLastSet", Integer.toString(0)))
            });
        }
        catch (NamingException e) {
            e.printStackTrace();
        }
    }

    private String studentDn(String userid) {
        return "cn=" + userid + "," + getConfigString("studentUserbase");
    }
    private String teacherDn(String userid) {
        return "cn=" + userid + "," + getConfigString("teacherUserbase");
    }

    public List<Student> fixStudents() {
        List<Student> groupsMissing = studentsWithGroupsMissing();
        groupsMissing.forEach(this::fixStudentsGroups);
        return groupsMissing;
    }

    public static void main(String[] args) throws IOException, ParseException {
        Configuration.getInstance().setConfigPath(args[0]);
        PaedML paedML = new PaedML();
        List<Student> students = paedML.readStudents();
        Student.listStudents(System.out, students);
        students.forEach(paedML::fixPasswordSettings);

        //List<Student> students = paedML.studentsWithGroupsMissing();
        //Student.listStudents(System.out, students);
        /*
        students.forEach(s -> {
            StringBuffer buffer = new StringBuffer(s.account).append(": ");
            for (String c : s.getCourses()) {
                buffer.append(c, 0, c.indexOf(",")).append(" ");
            }
            System.out.println(buffer);
        });
        System.out.println("students = " + students.size());
        students.forEach(paedML::fixStudentsGroups);
         */
    }

    /*
    private List<String> classGroups(Attributes attributes) throws NamingException {
        List<String> courses = new ArrayList<String>();
        Attribute attribute = attributes.get("memberof");
        if (attribute == null)
            return courses;

        NamingEnumeration<?> enumeration = attribute.getAll();
        while (enumeration.hasMoreElements()) {
            int type = 0;
            String value = (String)enumeration.nextElement();
            String group = value;
            if (group.startsWith(MEMBER_OF_CLASS)) {
                type = 1;
                group = group.substring(MEMBER_OF_CLASS.length(), group.indexOf(',', MEMBER_OF_CLASS.length()));
            }
            else if (group.startsWith(MEMBER_OF_OCTO)) {
                type = 2;
                group = group.substring(MEMBER_OF_OCTO.length(), group.indexOf(',', MEMBER_OF_OCTO.length()));
            }
            if (group.endsWith(schuljahr))
                group = group.substring(0, group.length() - schuljahr.length() - 1);
            if (group.endsWith("_Mitglieder"))
                group = group.substring(0, group.length() - "Mitglieder".length() - 1);

            if (type != 0)
                courses.add(value);
        }
        return courses;
    }
     */
}
