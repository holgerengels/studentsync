package studentsync.domains;

import studentsync.base.Diff;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Created by holger on 26.03.17.
 */
public class ChangedGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("utf-8");
        resp.setHeader("Content-Disposition","attachment; filename=changed.csv");

        PrintWriter writer = resp.getWriter();
        for (Diff.Change change : diff.getChanged()) {
            writer.print("\"" + change.getAccount() + "\",");
            writer.print("\"" + change.getFirstName() + "\",");
            writer.print("\"" + change.getLastName() + "\",");
            writer.print("\"" + change.getGender() + "\",");
            writer.print("\"" + change.getBirthday() + "\",");
            writer.print("\"" + change.getClazz() + "\"\n");
        }
        writer.close();
    }
}
