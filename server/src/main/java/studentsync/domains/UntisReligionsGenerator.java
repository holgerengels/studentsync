package studentsync.domains;

import studentsync.base.Choice;
import studentsync.base.Diff;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

/**
 * Created by holger on 26.03.17.
 */
public class UntisReligionsGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("utf-8");
        resp.setHeader("Content-Disposition","attachment; filename=religions.csv");

        List<Choice> choices = DomainFactory.getInstance().getSVP().loadStudentsReligions();
        PrintWriter writer = resp.getWriter();
        for (Choice choice : choices) {
            writer.print(quote(choice.getId())); // Short Name
            writer.print(',');
            writer.print(""); // Lesson Number
            writer.print(',');
            writer.print(quote(choice.getSubject())); // Subject
            writer.print(',');
            writer.print(""); // Lession Alias
            writer.print(',');
            writer.print(quote(choice.getClazz())); // Class
            writer.print(',');
            writer.print(""); // Statistical Code
            writer.print(',');
            writer.print(""); // reserved
            writer.print(',');
            writer.print(""); // reserved
            writer.print(',');
            writer.print(""); // reserved
            writer.print(',');
            writer.print("\n");
        }
        writer.close();
    }
}
