package studentsync.domains;

import studentsync.base.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Created by holger on 05.07.14.
 */
public class SVPReviewSyncTask
    extends Task<Report>
{
    private Diff doExecute() {
        SVP svp = DomainFactory.getInstance().getDomain(SVP.class);
        Bridge bridge = DomainFactory.getInstance().getDomain(Bridge.class);
        Reviews reviews = DomainFactory.getInstance().getDomain(Reviews.class);
        try {
            List<Student> master = svp.readStudents();
            List<Student> slave = bridge.readStudents();

            Diff diff = new Diff();
            diff.compare(master, slave, getPairs(), 0);
            List<Student> review = reviews.readStudents();
            List<Student> obsolete = new ArrayList<>(review);
            obsolete.removeAll(slave);
            Collections.sort(obsolete);
            diff.putList("obsolete", obsolete);

            report(diff);

            List<String> added = diff.getAdded().stream().map(Student::getAccount).collect(Collectors.toList());
            svp.loadStudents(added.toArray(new String[added.size()])).forEach(bridge::addStudent);
            List<String> kept = diff.getKept().stream().map(Student::getAccount).collect(Collectors.toList());
            bridge.updateStudents(svp.loadStudents(kept.toArray(new String[kept.size()])));
            List<String> changed = diff.getChanged().stream().map(Diff.Change::getAccount).collect(Collectors.toList());
            bridge.updateStudents(svp.loadStudents(changed.toArray(new String[changed.size()])));
            List<String> removed = diff.getRemoved().stream().map(Student::getAccount).collect(Collectors.toList());
            bridge.removeStudents(removed);

            removed = obsolete.stream().map(Student::getAccount).collect(Collectors.toList());
            removed.forEach(reviews::removeReview);

            Map<String, String> changes = new HashMap<>();
            changes.put("religion", "" + syncDomain(svp, bridge, "religion"));
            changes.put("state", "" + syncDomain(svp, bridge, "state"));
            changes.put("language", "" + syncDomain(svp, bridge, "language"));
            changes.put("class", "" + syncDomain(svp, bridge, "class"));

            demoData(bridge);

            diff.putNotes(changes);
            return diff;
        }
        finally {
            svp.release();
            bridge.release();
            reviews.release();
        }
    }

    private void demoData(Bridge bridge) {
        bridge.domainAdd("class", "DEMO");

        for (String id : new String[] { "demo", "raum142", "raum143", "raum144", "raum145", "raum146", "raum248", "raum414" }) {
            Map<String, Object> student = new HashMap<>();
            student.put("id", id);
            student.put("clazz", "DEMO");
            student.put("gender", "männlich");
            student.put("firstName", "Max");
            student.put("lastName", "Mustermann");
            student.put("birthDate", "1999-01-01");
            student.put("street", "Valckenburgufer");
            student.put("number", "21");
            student.put("postcode", "89073");
            student.put("city", "Ulm");
            student.put("phone", "01234567");
            student.put("birthCity", "Ulm");
            student.put("birthCountry", "Deutschland");
            student.put("nationality", "Deutschland");
            student.put("religion", "keine");
            student.put("language", "deutsch");
            Map<String, Object> parent = new HashMap<>();
            parent.put("gender", "Frau");
            parent.put("firstName", "Maxine");
            parent.put("lastName", "Musterfrau");
            parent.put("number", "8");
            parent.put("city", "Musterstadt");
            parent.put("phone", "01234567");
            parent.put("street", "Muster Str");
            parent.put("postcode", "77777");
            student.put("parent1", parent);

            bridge.addStudent(student);
        }
    }

    private int syncDomain(SVP svp, Bridge bridge, String domain) {
        List<String> master = svp.domain(domain);
        List<String> slave = bridge.domain(domain);
        List<String> added = new ArrayList<>(master);
        added.removeAll(slave);
        added.forEach(id -> bridge.domainAdd(domain, id));
        List<String> removed = new ArrayList<>(slave);
        removed.removeAll(master);
        removed.forEach(id -> bridge.domainRemove(domain, id));
        return added.size() + removed.size();
    }

    @Override
    public void run() {
        Diff diff = doExecute();

        if (diff.getAdded().size() != 0) {
            output.println("\n\nadded " + diff.getAdded().size());
            Student.listStudents(output, diff.getAdded());
        }
        if (diff.getKept().size() != 0) {
            output.println("\n\nkept " + diff.getKept().size());
            Student.listStudents(output, diff.getKept());
        }
        if (diff.getRemoved().size() != 0) {
            output.println("\n\nremoved " + diff.getRemoved().size());
            Student.listStudents(output, diff.getRemoved());
        }
    }

    @Override
    public Report execute() {
        Diff diff = doExecute();
        return report(diff);
    }

    private Report report(Diff diff) {
        Report report = new Report();
        report.put("added", diff.getAdded().size());
        report.put("updated", diff.getKept().size() + diff.getChanged().size());
        report.put("removed", diff.getRemoved().size());
        report.put("obsolete", diff.getList("obsolete").size());
        report.putAll(diff.getNotes());
        System.out.println("report = " + report);
        return report;
    }
}
