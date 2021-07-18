package studentsync.domains;

import studentsync.base.Diff;
import studentsync.base.Student;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Created by holger on 26.03.17.
 */
public class AddedGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("utf-8");
        resp.setHeader("Content-Disposition","attachment; filename=added.csv");

        PrintWriter writer = resp.getWriter();
        for (Student student : diff.getAdded()) {
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
