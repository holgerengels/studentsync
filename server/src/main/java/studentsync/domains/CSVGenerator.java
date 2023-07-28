package studentsync.domains;

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
        write(writer, students);
    }

    public void write(PrintWriter writer, List<Student> students) {
        for (Student student : students) {
            writer.print(escape(student.account) + ", ");
            writer.print(escape(student.firstName) + ", ");
            writer.print(escape(student.lastName) + ", ");
            writer.print(escape(student.gender) + ", ");
            writer.print(escape("" + student.birthday) + ", ");
            writer.print(escape(student.clazz) + "\n");
        }
        writer.close();
    }

    public String escape(String data) {
        String escapedData = data.replaceAll("\\R", " ");
        if (data.contains(",") || data.contains("\"") || data.contains("'")) {
            data = data.replace("\"", "\"\"");
            escapedData = "\"" + data + "\"";
        }
        return escapedData;
    }
}
