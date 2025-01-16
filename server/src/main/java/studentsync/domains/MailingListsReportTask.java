package studentsync.domains;

import studentsync.base.*;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

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
            List<Teacher> asvTeachers = asv.readTeachers();
            asv.amendWithFunctions(asvTeachers);
            asv.amendWithClass(asvTeachers);
            asv.amendWithTeams(asvTeachers);

            List<String> asvAllTeachers = asvTeachers.stream().map(Teacher::getAccount).toList();
            List<String> asvClassTeachers = asvTeachers.stream().filter(t -> t.getClazz() != null).map(Teacher::getAccount).toList();
            List<Teacher> mailCowTeachers = mailCow.readTeachers();
            List<String> mailCowAllTeachers = mailCowTeachers.stream().map(Teacher::getAccount).toList();
            List<String> mailCowListTeachers = mailCow.readList("lehrer");
            List<String> mailCowListClassTeachers = mailCow.readClassTeachers();

            Report report = new Report();

            ArrayList<String> missingBoxes = new ArrayList<>(asvAllTeachers);
            missingBoxes.removeAll(mailCowAllTeachers);
            if (!missingBoxes.isEmpty())
                report.put("missingBoxes", missingBoxes);
            ArrayList<String> unknownBoxes = new ArrayList<>(mailCowAllTeachers);
            unknownBoxes.removeAll(asvAllTeachers);
            if (!unknownBoxes.isEmpty())
                report.put("unknownBoxes", unknownBoxes);

            List<String> missingInAll = new ArrayList<>(asvAllTeachers);
            missingInAll.removeAll(mailCowListTeachers);
            if (!missingInAll.isEmpty())
                report.put("missing in lehrer", missingInAll);
            List<String> obsoleteInAll = new ArrayList<>(mailCowListTeachers);
            obsoleteInAll.removeAll(asvAllTeachers);
            if (!obsoleteInAll.isEmpty())
                report.put("obsolete in lehrer", obsoleteInAll);

            List<String> missingInClass = new ArrayList<>(asvClassTeachers);
            missingInClass.removeAll(mailCowListClassTeachers);
            if (!missingInClass.isEmpty())
                report.put("missing in klassenlehrer", missingInClass);
            List<String> obsoleteInClass = new ArrayList<>(mailCowListClassTeachers);
            obsoleteInClass.removeAll(asvClassTeachers);
            if (!obsoleteInClass.isEmpty())
                report.put("obsolete in klassenlehrer", obsoleteInClass);

            List<String> lists = asvTeachers.stream().flatMap(t -> t.getTeams().stream()).distinct().sorted().toList();
            for (String list : lists) {
                List<String> setpoint = asvTeachers.stream().filter(t -> t.getTeams().contains(list)).map(Teacher::getAccount).toList();
                List<String> actual = mailCow.readList(list);

                List<String> missing = new ArrayList<>(setpoint);
                missing.removeAll(actual);
                if (!missing.isEmpty())
                    report.put("missing in " + list, missing);
                List<String> obsolete = new ArrayList<>(actual);
                obsolete.removeAll(setpoint);
                if (!obsolete.isEmpty())
                    report.put("obsolete in " + list, obsolete);
            }
            return report;
        }
        finally {
            asv.release();
        }
    }
}
