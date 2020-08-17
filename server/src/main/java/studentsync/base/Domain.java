package studentsync.base;

import org.lightcouch.CouchDbClient;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Created by holger on 14.05.16.
 */
public abstract class Domain
{
    private static Map<String,DataSource> dataSources = Collections.synchronizedMap(new HashMap<>());
    private static Map<String,CouchDbClient> clients = Collections.synchronizedMap(new HashMap<>());

    private String domain;

    public Domain(String domain) {
        this.domain = domain;
    }

    private long millis = System.currentTimeMillis();

    public void start() {
        millis = System.currentTimeMillis();
    }

    protected void stop(String text) {
        System.out.println(getClass().getSimpleName() + " " + text + " " + (System.currentTimeMillis() - millis) + "ms");
        millis = System.currentTimeMillis();
    }

    protected void close(ResultSet resultSet) {
        if (resultSet == null)
            return;
        try {resultSet.close();} catch (Exception e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.WARNING, e.getMessage(), e);
        }
    }
    protected void close(Statement statement) {
        if (statement == null)
            return;
        try {statement.close();} catch (Exception e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.WARNING, e.getMessage(), e);
        }
    }
    protected void close(Connection connection) {
        if (connection == null)
            return;
        try {connection.close();} catch (Exception e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.WARNING, e.getMessage(), e);
        }
    }

    public int getFields() {
        return Diff.COMPARE_CLASS | Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME | Diff.COMPARE_BIRTHDAY | Diff.COMPARE_GENDER;
    }

    public List<Student> readStudents() {
        return null;
    }

    public List<Student> filterStudents(String search) {
        ArrayList<Student> students = new ArrayList<>();
        students.addAll(readStudents());
        return Student.filter(students, search);
    }

    protected synchronized Connection getConnection(String name) throws SQLException {
        return dataSources.computeIfAbsent(name, s -> createDataSource(name)).getConnection();
    }

    protected DataSource createDataSource(String name) { return null; };

    protected synchronized CouchDbClient getClient(String name) {
        return clients.computeIfAbsent(name, s -> createClient(name));
    }

    protected CouchDbClient createClient(String name) { return null; }

    protected String getConfigString(String key) {
        return Configuration.getInstance().getString(domain, key);
    }

    protected Integer getConfigInteger(String key) {
        return Configuration.getInstance().getInteger(domain, key);
    }

    public void release() {
    }
}
