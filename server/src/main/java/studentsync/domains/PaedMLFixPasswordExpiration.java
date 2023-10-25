package studentsync.domains;

import studentsync.base.Report;
import studentsync.base.Student;
import studentsync.base.Task;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Created by holger on 05.07.14.
 */
public class PaedMLFixPasswordExpiration
    extends Task<Report>
{
    @Override
    public void run() {
        PaedML paedML = DomainFactory.getInstance().getPaedML();
        List<Student> students = paedML.readStudents();
        Student.listStudents(output, students);
        students.forEach(paedML::fixStudentPasswordSettings);
        List<Student> teachers = paedML.readTeachers();
        Student.listStudents(output, teachers);
        teachers.forEach(paedML::fixTeacherPasswordSettings);
    }

    @Override
    public Report execute() {
        PaedML paedML = DomainFactory.getInstance().getPaedML();
        try {
            List<Student> students = paedML.readStudents();
            students.forEach(paedML::fixStudentPasswordSettings);
            List<Student> teachers = paedML.readTeachers();
            teachers.forEach(paedML::fixTeacherPasswordSettings);

            Report report = new Report();
            report.put("students", students.size());
            report.put("teachers", teachers.size());
            return report;
        }
        finally {
            paedML.release();
        }
    }
}
