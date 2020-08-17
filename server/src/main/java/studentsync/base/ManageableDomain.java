package studentsync.base;

public abstract class ManageableDomain extends Domain {
    public ManageableDomain(String domain) {
        super(domain);
    }

    public abstract void addStudent(Student student);

    public abstract void removeStudent(Student student);

    public abstract void changeStudent(Student student);
}
