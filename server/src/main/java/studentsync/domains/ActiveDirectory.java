package studentsync.domains;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import studentsync.base.*;

import javax.naming.Context;
import javax.naming.NamingEnumeration;
import javax.naming.NamingException;
import javax.naming.directory.*;
import javax.naming.ldap.*;
import java.io.IOException;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Created by holger on 20.12.14.
 */
public class ActiveDirectory
    extends Domain
{
    static String POSTFIX = "OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml";

    private final String schuljahr;

    ThreadLocal<LdapContext> ldapContext = ThreadLocal.withInitial(() -> {
        try {
            ExtendedTrustManager.getInstance(Configuration.getInstance().getConfig());

            System.out.println("ActiceDirectory: establishing connection");
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
        System.out.println("ActiceDirectory: closing connection");
        ldapContext.remove();
    }

    public ActiveDirectory() {
        super("ldap");
        schuljahr = getConfigString("schuljahr");
    }

    public synchronized HashMap<String, List<String>> readUsers() {
        LdapContext context = null;
        try {
            context = ldapContext.get();
            context.setRequestControls(new Control[]{ new PagedResultsControl(100, false) });
            String searchFilter = "(&(objectClass=User))";

            SearchControls searchControls = new SearchControls();
            String[] resultAttributes = { "cn", "memberof" };
            searchControls.setReturningAttributes(resultAttributes);
            searchControls.setSearchScope(SearchControls.SUBTREE_SCOPE);
            searchControls.setCountLimit(2000);

            HashMap<String, List<String>> users = new HashMap<>();

            byte[] b = null;
            do {
                NamingEnumeration results = context.search(getConfigString("userbase"), searchFilter, searchControls);

                if (results != null) {
                    while (results.hasMoreElements()) {
                        SearchResult searchResult = (SearchResult)results.nextElement();
                        Attributes attributes = searchResult.getAttributes();
                        String dn = searchResult.getNameInNamespace();
                        List<String> groups = groups(attributes);
                        users.put(dn, groups);
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
            return users;
        }
        catch (NamingException | IOException e) {
            Logger.getLogger("SVPUntis").log(Level.SEVERE, e.getMessage(), e);
            return new HashMap<>();
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

    private List<String> groups(Attributes attributes) throws NamingException {
        List<String> groups = new ArrayList<String>();
        Attribute attribute = attributes.get("memberof");
        if (attribute == null)
            return groups;

        NamingEnumeration<?> enumeration = attribute.getAll();
        while (enumeration.hasMoreElements()) {
            String group = (String)enumeration.nextElement();
            if (group.endsWith(POSTFIX)) {
                groups.add(group);
            }
        }
        return groups;
    }


    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        ActiveDirectory ads = new ActiveDirectory();
        List<Mapping> mappings = ads.readMappings();
        List<Job> jobs = ads.createJobs(mappings);
        ads.executeJobs(jobs);

        //ads.addUserToGroup("CN=G_WLAN,OU=Active Directory,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml", "CN=h.engels,OU=VBS,OU=Lehrer,OU=Benutzer,DC=musterschule,DC=schule,DC=paedml");
        //ads.addUserToGroup("CN=G_WLAN,OU=Active Directory,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml", "CN=s.spann,OU=VBS,OU=Lehrer,OU=Benutzer,DC=musterschule,DC=schule,DC=paedml");
        //ads.removeUserFromGroup("CN=G_WLAN,OU=Active Directory,OU=Sicherheitsgruppen,DC=musterschule,DC=schule,DC=paedml", "CN=h.engels,OU=VBS,OU=Lehrer,OU=Benutzer,DC=musterschule,DC=schule,DC=paedml");
    }

    public List<String> performMapping() {
        List<Mapping> mappings = readMappings();
        System.out.println("mappings = " + mappings);
        List<Job> jobs = createJobs(mappings);
        executeJobs(jobs);
        List<String> report = new ArrayList<>();
        jobs.forEach(job -> {
            job.adds.stream().map(add -> "added " + job.user + " to " + add).forEach(report::add);
            job.removes.stream().map(remove -> "removed " + job.user + " from " + remove).forEach(report::add);
        });
        return report;
    }

    private void executeJobs(List<Job> jobs) {
        for (Job job : jobs) {
            job.adds.forEach(add -> addUserToGroup(add, job.user));
            job.removes.forEach(remove -> removeUserFromGroup(remove, job.user));
        }
    }

    private List<Job> createJobs(List<Mapping> mappings) {
        HashMap<String, List<String>> users = readUsers();
        List<Job> jobs = new ArrayList<>();
        users.forEach((user, groups) -> {
            List<String> needs = new ArrayList<>();
            List<String> adds = new ArrayList<>();
            List<String> removes = new ArrayList<>();
            for (Mapping mapping : mappings) {
                if (groups.contains(mapping.from)) {
                    needs.add(mapping.to);
                    if (!groups.contains(mapping.to)) {
                        adds.add(mapping.to);
                    }
                }
            }
            for (Mapping mapping : mappings) {
                if (groups.contains(mapping.to) && !groups.contains(mapping.from) && !needs.contains(mapping.to) && !removes.contains(mapping.to)) {
                    removes.add(mapping.to);
                }
            }
            if (!adds.isEmpty() || !removes.isEmpty()) {
                jobs.add(new Job(user, adds, removes));
            }
        });
        return jobs;
    }

    private List<Mapping> readMappings() {
        JsonArray array = Configuration.getInstance().getConfig().getAsJsonArray("groupMapping");
        List<Mapping> mappings = new ArrayList<>();
        for (JsonElement element : array) {
            JsonObject object = (JsonObject)element;
            Map.Entry<String, JsonElement> line = object.entrySet().iterator().next();
            String from = line.getKey();
            if (from.contains("class"))
                from = from.toLowerCase();
            from = from.replaceFirst("class\\((.*)\\)", "CN=G_Schueler_VBS_$1_" + schuljahr + ",OU=FileShare");
            from = from.replaceFirst("group\\((.*)\\)", "CN=$1,OU=Active Directory");
            from = from + "," + POSTFIX;
            String to = line.getValue().getAsString();
            to = to.replaceFirst("group\\((.*)\\)", "CN=$1,OU=Active Directory");
            to = to + "," + POSTFIX;
            mappings.add(new Mapping(from, to));
        }
        return mappings;
    }

    private void addUserToGroup(String group, String user) {
        try {
            LdapContext context = ldapContext.get();
            context.modifyAttributes(group, new ModificationItem[] {
                    new ModificationItem(DirContext.ADD_ATTRIBUTE, new BasicAttribute("member", user)),
            });
            System.out.println("added " + user + " to " + group);
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void removeUserFromGroup(String group, String user) {
        try {
            LdapContext context = ldapContext.get();
            context.modifyAttributes(group, new ModificationItem[] {
                    new ModificationItem(DirContext.REMOVE_ATTRIBUTE, new BasicAttribute("member", user)),
            });
            System.out.println("removed " + user + " from " + group);
        }
        catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static class Mapping {
        private String from;
        private String to;

        public Mapping(String from, String to) {
            this.from = from;
            this.to = to;
        }

        public String getFrom() {
            return from;
        }

        public String getTo() {
            return to;
        }

        @Override
        public String toString() {
            return "Mapping{" +
                    "from='" + from + '\'' +
                    ", to='" + to + '\'' +
                    '}';
        }
    }

    private static class Job {

        private final String user;
        private final List<String> adds;
        private final List<String> removes;

        public Job(String user, List<String> adds, List<String> removes) {
            this.user = user;
            this.adds = adds;
            this.removes = removes;
        }
    }
}
