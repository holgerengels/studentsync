package studentsync.base;

/**
 * Created by holger on 05.08.16.
 */
public class Choice {
    String id;
    String clazz;
    String subject;

    public Choice(String id, String clazz, String subject) {
        this.id = id;
        this.clazz = clazz;
        this.subject = subject;
    }

    public String getId() {
        return id;
    }

    public String getClazz() {
        return clazz;
    }

    public String getSubject() {
        return subject;
    }

    @Override
    public String toString() {
        return "studentsync.base.Choice{" +
            "id='" + id + '\'' +
            ", clazz='" + clazz + '\'' +
            ", subject='" + subject + '\'' +
            '}';
    }
}
