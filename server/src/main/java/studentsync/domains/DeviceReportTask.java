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
public class DeviceReportTask
    extends Task<Report>
{
    @Override
    public void run() {
        Relution relution = DomainFactory.getInstance().getRelution();
        ASV asv = DomainFactory.getInstance().getASV();
        Untis untis = DomainFactory.getInstance().getUntis();
    }

    @Override
    public Report execute() {
        Relution relution = DomainFactory.getInstance().getRelution();
        ASV asv = DomainFactory.getInstance().getASV();
        Untis untis = DomainFactory.getInstance().getUntis();

        JsonObject config = Configuration.getInstance().getConfig().getAsJsonObject("relution");
        List<String> tabletClasses = StreamSupport.stream(config.getAsJsonArray("tabletClasses").spliterator(), false)
                .map(JsonElement::getAsString).sorted().collect(Collectors.toList());

        try {
            List<Student> deviceOwners = relution.readStudents();
            List<Student> students = asv.readStudents();
            List<Student> teachers = untis.readTeachers().values().stream().map(s -> new Student(s, null, null)).sorted().collect(Collectors.toList());
            List<Student> tabletClassStudents = new ArrayList<>();
            List<Student> otherClassStudents = new ArrayList<>();
            students.forEach(s -> {
                if (tabletClasses.contains(s.getClazz()))
                    tabletClassStudents.add(s);
                else
                    otherClassStudents.add(s);
            });
            List<Student> persons = new ArrayList<>();
            persons.addAll(students);
            persons.addAll(teachers);
            Collections.sort(persons);

            List<Student> multipleDevices = relution.readDeviceOwners().stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                    .entrySet().stream().filter(e -> e.getValue() != 1).map(Map.Entry::getKey).collect(Collectors.toList());

            Report report = new Report();
            report.put("multipleDevices", multipleDevices.stream().map(Student::getAccount).collect(Collectors.toList()));

            List<Student> unknownOwners = new ArrayList<>(deviceOwners);
            unknownOwners.removeAll(persons);
            report.put("unknownOwners", unknownOwners.stream().map(Student::getAccount).collect(Collectors.toList()));

            List<Student> deviceButNotTabletClass = new ArrayList<>();
            deviceButNotTabletClass.addAll(deviceOwners);
            deviceButNotTabletClass.removeAll(unknownOwners);
            deviceButNotTabletClass.removeAll(teachers);
            deviceButNotTabletClass.removeAll(tabletClassStudents);
            report.put("deviceButNotTabletClass", deviceButNotTabletClass.stream().map(Student::getAccount).collect(Collectors.toList()));

            List<Student> noDeviceButTabletClass = new ArrayList<>();
            noDeviceButTabletClass.addAll(tabletClassStudents);
            noDeviceButTabletClass.removeAll(deviceOwners);
            report.put("noDeviceButTabletClass", noDeviceButTabletClass.stream().map(Student::getAccount).collect(Collectors.toList()));

            return report;
        }
        finally {
            asv.release();
        }
    }
}
