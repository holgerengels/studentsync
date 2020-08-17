package studentsync.domains;

import studentsync.base.Diff;
import studentsync.base.Student;

import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Date;
import java.text.SimpleDateFormat;

/**
 * Created by holger on 26.03.17.
 */
public class UntisImportGenerator extends Generator<Diff> {
    @Override
    public void write(HttpServletResponse resp, Diff diff) throws IOException {
        resp.setContentType("text/csv");
        resp.setCharacterEncoding("utf-8");
        resp.setHeader("Content-Disposition","attachment; filename=added.csv");

        PrintWriter writer = resp.getWriter();
        for (Student student : diff.getAdded()) {
            writer.print(quote(student.account)); // Name
            writer.print(',');
            writer.print(quote(student.lastName)); // Langname
            writer.print(',');
            writer.print(""); // Text
            writer.print(',');
            writer.print(""); // Beschreibung
            writer.print(',');
            writer.print(""); // Statistik 1
            writer.print(',');
            writer.print(""); // Statistik 2
            writer.print(',');
            writer.print(quote(student.gender != null ? student.gender.toUpperCase() : "")); // Kennzeichen
            writer.print(',');
            writer.print(quote(student.firstName)); // Vorname
            writer.print(',');
            writer.print(""); // Schülernummer
            writer.print(',');
            writer.print(quote(student.clazz)); // Klasse
            writer.print(',');
            writer.print(student.gender != null ? student.gender.equals("m") ? "2" : "1" : "0"); // Geschlecht
            writer.print(',');
            writer.print(""); // (Kurs-)Optimierungskennzeichen
            writer.print(',');
            writer.print(quoteDate(student.birthday)); // Geburtsdatum JJJJMMTT
            writer.print(',');
            writer.print(""); // E-Mail Adresse
            writer.print(',');
            writer.print(quote(student.account)); // Fremdschlüssel
            writer.print("\n");
        }
        writer.close();
    }

    private SimpleDateFormat dateFormat = new SimpleDateFormat("yyyyMMdd");

    private String quoteDate(Date birthday) {
        return birthday != null ? dateFormat.format(birthday) : "";
    }
}
