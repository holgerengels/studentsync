package studentsync.domains;

import studentsync.base.SelfExpiringHashMap;
import studentsync.base.Domain;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by holger on 21.07.16.
 */
public class DomainFactory
{
    private static final Map<String, Class<? extends Domain>> SERVERS = new HashMap<>(); static {
        SERVERS.put("asv", ASV.class);
        SERVERS.put("svp", SVP.class);
        SERVERS.put("untis", Untis.class);
        SERVERS.put("webuntis", Webuntis.class);
        SERVERS.put("bridge", Bridge.class);
        SERVERS.put("reviews", Reviews.class);
        SERVERS.put("paedml", PaedML.class);
        SERVERS.put("schulkonsole", Schulkonsole.class);
        SERVERS.put("owncloud", NextCloud.class);
        SERVERS.put("relution", Relution.class);
        SERVERS.put("mailCow", MailCow.class);
    }
    private static DomainFactory INSTANCE = null;
    private Map<Class, Domain> domains = new SelfExpiringHashMap<>(5000);

    public DomainFactory() {}

    public synchronized static DomainFactory getInstance() {
        if (INSTANCE == null)
            INSTANCE = new DomainFactory();
        
        return INSTANCE;
    }

    public synchronized <S extends Domain> S getDomain(String name) {
        return getDomain((Class<S>)SERVERS.get(name));
    }

    public synchronized <S extends Domain> S getDomain(Class<S> clazz) {
        System.out.println("ServerFactory: " + (domains.containsKey(clazz) ? "reusing" : "creating new") + " " + clazz.getSimpleName());
        return (S) domains.computeIfAbsent(clazz, s -> createServer(clazz));
    }

    protected <S extends Domain> S createServer(Class<S> clazz) {
        try {
            Constructor<S>  constructor = clazz.getConstructor();
            return constructor.newInstance();
        }
        catch (NoSuchMethodException | InvocationTargetException | InstantiationException | IllegalAccessException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    public ASV getASV() { return getDomain(ASV.class); }
    public ActiveDirectory getActiveDirectory() { return getDomain(ActiveDirectory.class); }
    public SVP getSVP() { return getDomain(SVP.class); }
    public Untis getUntis() {
        return getDomain(Untis.class);
    }
    public Webuntis getWebuntis() {
        return getDomain(Webuntis.class);
    }
    public PaedML getPaedML() { return getDomain(PaedML.class); }
    public Schulkonsole getSchulkonsole() { return getDomain(Schulkonsole.class); }
    public Bridge getBridge() { return getDomain(Bridge.class); }
    public Relution getRelution() { return getDomain(Relution.class); }
    public MailCow getMailCow() { return getDomain(MailCow.class); }
}
