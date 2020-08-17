package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Task;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Created by holger on 05.07.14.
 */
public class ADGroupMappingTask
    extends Task<Report>
{
    @Override
    public void run() {
        ActiveDirectory ads = DomainFactory.getInstance().getActiveDirectory();
        List<String> jobs = ads.performMapping();

        if (!jobs.isEmpty()) {
            jobs.forEach(System.out::println);
        }
    }

    @Override
    public Report execute() {
        ActiveDirectory ads = DomainFactory.getInstance().getActiveDirectory();
        try {
            List<String> jobs = ads.performMapping();
            Report report = new Report();
            report.put("adds", (int) jobs.stream().filter(line -> line.startsWith("added")).map(line -> line.substring("added ".length())).count());
            report.put("removes", (int) jobs.stream().filter(line -> line.startsWith("removed")).map(line -> line.substring("removed ".length())).count());
            return report;
        }
        finally {
            ads.release();
        }
    }
}
