package studentsync.domains;

import org.apache.commons.io.IOUtils;

import java.io.*;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Created by holger on 11.07.17.
 */
public class Birthdates {
    private static final SimpleDateFormat parse = new SimpleDateFormat("dd.MM.yyyy");
    private static final SimpleDateFormat format = new SimpleDateFormat("yyyyMMdd");

    static String calendarPrefix = "BEGIN:VCALENDAR\n" +
        "PRODID:-//Mozilla.org/NONSGML Mozilla Calendar V1.1//EN\n" +
        "VERSION:2.0\n";
    static String calendarPostfix = "END:VCALENDAR\n";

    static String eventPrefix = "BEGIN:VEVENT\n" +
        "CREATED:20170710T152858Z\n" +
        "LAST-MODIFIED:20170710T152858Z\n" +
        "DTSTAMP:20170711T050658Z\n";
    static String eventCommon = "PRIORITY:5\n" +
        "RRULE:FREQ=YEARLY\n" +
        "SEQUENCE:0\n" +
        "X-MICROSOFT-CDO-ALLDAYEVENT:TRUE\n" +
        "TRANSP:TRANSPARENT\n" +
        "X-MICROSOFT-CDO-BUSYSTATUS:FREE\n";
    static String eventPostfix = "END:VEVENT\n";

    static void appendSummary(StringBuilder builder, String name) {
        builder.append("SUMMARY:");
        builder.append(name);
        builder.append("\n");
    }

    static void appendDate(StringBuilder builder, String date) {
        try {
            Date d1 = parse.parse(date);
            Date d2 = new Date(d1.getTime() + 1000 * 60 * 60 * 24);
            builder.append("DTSTART;VALUE=DATE:");
            builder.append(format.format(d1));
            builder.append("\n");
            builder.append("DTEND;VALUE=DATE:");
            builder.append(format.format(d2));
            builder.append("\n");
        }
        catch (ParseException e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) throws IOException {
        LineNumberReader reader = new LineNumberReader(new FileReader(args[0]));
        StringBuilder builder = new StringBuilder();
        builder.append(calendarPrefix);
        String line = reader.readLine();
        while ((line = reader.readLine()) != null) {
            String[] columns = line.split(",");
            String name = columns[1];
            String date = columns[2];

            builder.append(eventPrefix);
            builder.append(eventCommon);
            appendSummary(builder, name);
            appendDate(builder, date);
            builder.append(eventPostfix);
        }
        builder.append(calendarPostfix);

        FileWriter writer = new FileWriter(args[1]);
        IOUtils.copy(new StringReader(builder.toString()), writer);
        writer.close();
    }
}
