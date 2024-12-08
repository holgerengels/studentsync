package studentsync.domains;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import studentsync.base.Configuration;
import studentsync.base.Report;
import studentsync.base.Student;
import studentsync.base.Task;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Created by holger on 05.07.14.
 */
public class MailingListsReportTask
    extends Task<Report>
{
    @Override
    public void run() {
        MailCow mailCow = DomainFactory.getInstance().getMailCow();
        ASV asv = DomainFactory.getInstance().getASV();
    }

    @Override
    public Report execute() {
        MailCow mailCow = DomainFactory.getInstance().getMailCow();
        ASV asv = DomainFactory.getInstance().getASV();

        try {
            List<Student> asvTeachers = asv.readTeachers();
            List<String> asvAllTeachers = asv.readTeachers().stream().map(teacher -> teacher.eMail).toList();
            List<String> asvClassTeachers = asv.readClassTeachers();
            List<Student> mailCowTeachers = mailCow.readTeachers();
            List<String> mailCowAllTeachers = mailCow.readAllTeachers();
            List<String> mailCowClassTeachers = mailCow.readClassTeachers();

            Report report = new Report();

            List<Student> missingBoxes = new ArrayList<>(asvTeachers);
            missingBoxes.removeAll(mailCowTeachers);
            report.put("missingBoxes", missingBoxes.stream().map(Student::getEMail).collect(Collectors.toList()));
            List<Student> unknownBoxes = new ArrayList<>(mailCowTeachers);
            unknownBoxes.removeAll(asvTeachers);
            report.put("unknownBoxes", unknownBoxes.stream().map(Student::getEMail).collect(Collectors.toList()));

            List<String> missingInAll = new ArrayList<>(asvAllTeachers);
            missingInAll.removeAll(mailCowAllTeachers);
            report.put("missingInAll", missingInAll);
            List<String> obsoleteInAll = new ArrayList<>(mailCowAllTeachers);
            obsoleteInAll.removeAll(asvAllTeachers);
            report.put("obsoleteInAll", obsoleteInAll);

            List<String> missingInClass = new ArrayList<>(asvClassTeachers);
            missingInClass.removeAll(mailCowClassTeachers);
            report.put("missingInClass", missingInClass);
            List<String> obsoleteInClass = new ArrayList<>(mailCowClassTeachers);
            obsoleteInClass.removeAll(asvClassTeachers);
            report.put("obsoleteInClass", obsoleteInClass);

            return report;
        }
        finally {
            asv.release();
        }
    }
}
