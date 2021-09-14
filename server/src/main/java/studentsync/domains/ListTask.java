package studentsync.domains;

import studentsync.base.*;

import java.io.IOException;
import java.util.List;

public class ListTask
    extends Task<List<Student>>
{
    private final String domainName;

    public ListTask(String domainName) {
        this.domainName = domainName;
    }

    public Domain getDomain() {
        return DomainFactory.getInstance().getDomain(domainName);
    }
    
    public List<Student> list() {
        try {
            return getDomain().readStudents();
        }
        finally {
            getDomain().release();
        }
    }

    public List<Student> filter(String search) {
        return getDomain().filterStudents(search);
    }

    public void print(List<Student> list) {
        Student.listStudents(output, list);
    }
    
    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        ListTask task = new ListTask("paedml");
        task.print(task.list());
    }

    @Override
    public List<Student> execute() {  return list();
    }

    @Override
    public void run() {
    }
}
