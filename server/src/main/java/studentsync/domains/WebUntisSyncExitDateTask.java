package studentsync.domains;

import studentsync.base.*;

import java.sql.Date;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Created by holger on 05.07.14.
 */
public class WebUntisSyncExitDateTask
    extends Task<Report>
{
    @Override
    public void run() {
        ASV asv = DomainFactory.getInstance().getASV();
        Webuntis webuntis = DomainFactory.getInstance().getWebuntis();
        int fields = Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME;
        Diff diff = new Diff().compare(asv.readStudents(), webuntis.readStudents(), getPairs(), fields);
        List<String> removed = diff.getRemoved().stream().map(s -> s.account).collect(Collectors.toList());
        Map<String, Date> map = asv.readExitDates(removed);
        webuntis.writeExitDates(map);
    }

    @Override
    public Report execute() {
        ASV asv = DomainFactory.getInstance().getASV();
        Webuntis webuntis = DomainFactory.getInstance().getWebuntis();
        try {
            int fields = Diff.COMPARE_FIRST_NAME | Diff.COMPARE_LAST_NAME;
            Diff diff = new Diff().compare(asv.readStudents(), webuntis.readStudents(), getPairs(), fields);
            List<String> removed = diff.getRemoved().stream().map(s -> s.account).collect(Collectors.toList());
            Map<String, Date> map = asv.readExitDates(removed);
            webuntis.writeExitDates(map);
            Report report = new Report();
            report.put("ids", map.keySet());
            return report;
        }
        finally {
            asv.release();
        }
    }

    public static void main(String[] args) {
        Configuration.getInstance().setConfigPath(args[0]);
        new WebUntisSyncExitDateTask().run();
    }
}
