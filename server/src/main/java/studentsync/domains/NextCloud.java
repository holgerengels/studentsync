package studentsync.domains;

import com.jcabi.ssh.Shell;
import com.jcabi.ssh.Ssh;
import org.apache.commons.io.FileUtils;
import studentsync.base.Diff;
import studentsync.base.Configuration;
import studentsync.base.Domain;
import studentsync.base.Student;

import javax.sql.DataSource;
import java.io.File;
import java.io.IOException;
import java.util.*;

/**
 * Created by holger on 13.09.16.
 */
public class NextCloud extends Domain {
    private List<Student> students;

    public NextCloud() {
        super("nextcloud");
    }

    @Override
    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        students = new ArrayList<>();

        try {
            String file = getConfigString("key");
            String key = FileUtils.readFileToString(new File(file), "UTF-8");
            Shell shell = new Ssh(getConfigString("host"), getConfigInteger("port"), getConfigString("user"), key, getConfigString("passphrase"));

            String dirs = new Shell.Plain(shell).exec("sudo ls " + getConfigString("datadir"));
            List<String> list = new ArrayList<>(Arrays.asList(dirs.split("\n")));
            list.remove("files");
            list.remove("files_external");
            list.remove("index.html");
            list.remove("__groupfolders");
            list.remove("nextcloud.db");
            list.remove("nextcloud.log");
            list.remove("updater.log");
            list.remove("vbs");
            list.remove("kmap");
            for (String line : list)
                students.add(new Student(line, null, null));
        }
        catch (IOException e) {
            e.printStackTrace();
        }
        return students;
    }

    @Override
    protected DataSource createDataSource(String name) {
        return null;
    }

    public static void main(String[] args) throws IOException {
        Configuration.getInstance().setConfigPath(args[0]);
        NextCloud nextCloud = new NextCloud();
        List<Student> cloudStudents = nextCloud.readStudents();

        ASV asv = new ASV();
        List<Student> asvStudents = asv.readStudents();

        Untis untis = new Untis();
        Map<String, String> teachers = untis.readTeachers();
        teachers.forEach((id, userid) -> asvStudents.add(new Student(userid, null, null)));
        asvStudents.add(new Student("PAL", null, null));
        asvStudents.add(new Student("pdl", null, null));
        asvStudents.add(new Student("Verwaltung", null, null));
        asvStudents.add(new Student("t.voelker", null, null));
        asvStudents.add(new Student("sekretariat", null, null));
        Diff diff = new Diff();
        diff.compare(asvStudents, cloudStudents, Collections.emptyList(), 0);
        System.out.println("REMOVE");
        Student.listStudents(System.out, diff.getRemoved());
    }
}
