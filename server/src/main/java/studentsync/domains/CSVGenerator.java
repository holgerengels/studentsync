package studentsync.domains;

import studentsync.base.Diff;
import studentsync.base.Student;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Created by holger on 26.03.17.
 */
public class CSVGenerator extends Generator<List<Student>> {
    @Override
    public void write(HttpServletResponse resp, List<Student> students) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("utf-8");
        resp.setHeader("Content-Disposition","attachment; filename=export.csv");

        PrintWriter writer = resp.getWriter();
        for (Student student : students) {
            writer.print("\"" + student.account + "\",");
            writer.print("\"" + student.firstName + "\",");
            writer.print("\"" + student.lastName + "\",");
            writer.print("\"" + student.gender + "\",");
            writer.print("\"" + student.birthday + "\",");
            writer.print("\"" + student.clazz + "\"\n");
        }
        writer.close();
    }
}
