package studentsync.domains;

import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import studentsync.base.*;
import java.util.*;

/**
 * Created by holger on 05.07.14.
 */
public class SyncGuardiansTask
    extends Task<Report>
{
    @Override
    public void run() {
        ASV asv = DomainFactory.getInstance().getASV();
        Webuntis webuntis = DomainFactory.getInstance().getWebuntis();
        CloseableHttpClient client = webuntis.client();
        List<Student> students = asv.studentsWithGuardianContact();
        System.out.println("students = " + students);
        List<Guardian> guardians = webuntis.guardians(client);
        Map<String, Guardian> guardiansMap = new HashMap<>();
        guardians.forEach(guardian -> { guardiansMap.put( guardian.eMail, guardian); });
        System.out.println("guardians = " + guardians);

        // guardians associated to students, which are not present in webuntis
        List<Guardian> missingGuardians = new ArrayList<>();
        students.forEach(student -> {
            List<Guardian> list = (List<Guardian>)student.getAggregates().get("guardians");
            list.forEach(guardian -> {
                if (!guardiansMap.containsKey(guardian.eMail) && !missingGuardians.contains(guardian)) {
                    missingGuardians.add(guardian);
                }
            });
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
        guardiansMissingStudents.forEach(guardian -> {
            List<Student> list = new ArrayList<>();
            students.forEach(student -> {
                if (((List<Guardian>)student.getAggregates().get("guardians")).contains(guardian)) {
                    if (!guardian.getStudents().contains(student)) {
                        list.add(student);
                    }
                }
            });
            System.out.println("for guardian " + guardian + " add " + list);
            guardian.getStudents().addAll(list);
            webuntis.saveGuardian(client, guardian);
        });
    }

    @Override
    public Report execute() {
        return null;
    }

    public static void main(String[] args) {
        Configuration.getInstance().setConfigPath(args[0]);
        new SyncGuardiansTask().run();
    }
}
