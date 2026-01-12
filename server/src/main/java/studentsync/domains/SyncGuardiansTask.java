package studentsync.domains;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import studentsync.base.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Stream;

/**
 * Created by holger on 05.07.14.
 */
public class SyncGuardiansTask
    extends Task<Report>
{
    @Override
    public void run() {
    }

    @Override
    public Report execute() {
        Report report = new Report();

        ASV asv = DomainFactory.getInstance().getASV();
        Webuntis webuntis = DomainFactory.getInstance().getWebuntis();
        CloseableHttpClient client = webuntis.client();
        List<Student> students = asv.studentsWithGuardianContact();
        List<Guardian> guardians = webuntis.guardians(client);
        Map<String, Guardian> guardiansMap = new HashMap<>();
        guardians.forEach(guardian -> { guardiansMap.put( guardian.eMail, guardian); });

        // guardians associated to students, which are not present in webuntis (new guardians)
        List<Guardian> missingGuardians = new ArrayList<>();
        students.forEach(student -> {
            List<Guardian> list = (List<Guardian>)student.getAggregates().get("guardians");
            list.forEach(guardian -> {
                if (!guardiansMap.containsKey(guardian.eMail) && !missingGuardians.contains(guardian)) {
                    missingGuardians.add(guardian);
                }
            });
        });

        // guardians in webuntis without or with obsolete students
        List<Guardian> guardiansWithoutChildren = new ArrayList<>();
        List<Guardian> guardiansWithObsoleteChildren = new ArrayList<>();
        guardians.forEach(guardian -> {
            AtomicBoolean without = new AtomicBoolean(true);
            AtomicBoolean obsolete = new AtomicBoolean(false);
            guardian.getStudents().forEach(student -> {
                if (students.contains(student)) {
                    without.set(false);
                }
                else {
                    obsolete.set(true);
                }
            });
            if (without.get()) {
                guardiansWithoutChildren.add(guardian);
            }
            else if (obsolete.get()) {
                guardiansWithObsoleteChildren.add(guardian);
            }
        });

        // guardians in webuntis, which are not associated with all their students
        List<Guardian> guardiansMissingStudents = new ArrayList<>();
        students.forEach(student -> {
            List<Guardian> list = (List<Guardian>)student.getAggregates().get("guardians");
            list.forEach(guardian -> {
                guardian = guardiansMap.get(guardian.eMail);
                if (guardian != null) {
                    if (!guardian.getStudents().contains(student)) {
                        guardiansMissingStudents.add(guardian);
                    }
                }
            });
        });

        missingGuardians.forEach(guardian -> {
            List<Student> list = new ArrayList<>();
            students.forEach(student -> {
                if (((List<Guardian>)student.getAggregates().get("guardians")).contains(guardian)) {
                    if (!guardian.getStudents().contains(student)) {
                        list.add(student);
                    }
                }
            });
            System.out.println("add guardian " + guardian + " for " + list);
            guardian.getStudents().addAll(list);
            webuntis.saveGuardian(client, guardian);
        });
        Stream.concat(guardiansMissingStudents.stream(), guardiansWithObsoleteChildren.stream()).forEach(guardian -> {
            List<Student> list = new ArrayList<>();
            students.forEach(student -> {
                if (((List<Guardian>)student.getAggregates().get("guardians")).contains(guardian)) {
                    if (!guardian.getStudents().contains(student)) {
                        list.add(student);
                    }
                }
            });
            System.out.println("update guardian " + guardian + " old " + guardian.getStudents());
            System.out.println("update guardian " + guardian + " new " + list);
            guardian.getStudents().clear();
            guardian.getStudents().addAll(list);
            webuntis.saveGuardian(client, guardian);
        });
        // TODO: remove obsolete guardians

        report.put("added", missingGuardians.stream().map(Guardian::getEMail).toList());
        report.put("updated", Stream.concat(guardiansMissingStudents.stream(), guardiansWithObsoleteChildren.stream()).map(Guardian::getEMail).toList());
        return report;
    }

    public static void main(String[] args) {
        Configuration.getInstance().setConfigPath(args[0]);
        new SyncGuardiansTask().run();
    }
}
