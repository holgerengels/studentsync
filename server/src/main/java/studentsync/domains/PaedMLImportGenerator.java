package studentsync.domains;

import studentsync.base.Diff;
import studentsync.base.Student;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Created by holger on 27.03.17.
 */
public class PaedMLImportGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("iso-8859-1");
        resp.setHeader("Content-Disposition","attachment; filename=added.csv");

        PrintWriter writer = resp.getWriter();
        for (Student student : diff.getAdded()) {
            writer.print(nocomma(student.firstName)); // Vorname
            writer.print(',');
            writer.print(nocomma(student.lastName)); // Nachname
            writer.print(',');
            writer.print(nocomma(student.account)); // Benutzername
            writer.print(',');
            writer.print("V8lcke9burg"); // Kennwort
            writer.print(',');
            writer.print(nocomma(student.clazz)); // Klasse
            writer.print("\n");
        }
        writer.close();
    }
}
