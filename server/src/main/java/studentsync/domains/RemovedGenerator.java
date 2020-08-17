package studentsync.domains;

import studentsync.base.Diff;
import studentsync.base.Student;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Created by holger on 26.03.17.
 */
public class RemovedGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("utf-8");
        resp.setHeader("Content-Disposition","attachment; filename=removed.csv");

        PrintWriter writer = resp.getWriter();
        for (Student student : diff.getRemoved()) {
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
