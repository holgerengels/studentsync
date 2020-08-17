package studentsync.base;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Created by holger on 17.10.14.
 */
public class UserIDs {
    private static List<String> FORBIDDEN = Arrays.asList("exe");

    public static String encode(String name) {
        name = name.trim();
        name = name.toLowerCase();
        name = name.replaceAll("\\p{Space}+-\\p{Space}+", "");
        name = name.replaceAll("\\p{Space}+", "");
        name = name.replaceAll("ä", "ae");
        name = name.replaceAll("ö", "oe");
        name = name.replaceAll("ü", "ue");
        name = name.replaceAll("ß", "ss");
        name = name.replaceAll("'", "");
        name = name.replaceAll("`", "");
        name = name.replaceAll("´", "");
        name = name.replaceAll("-", "");
        return Normalizer.normalize(name, Normalizer.Form.NFD).chars()
            .filter(c -> Character.getType(c) != Character.NON_SPACING_MARK)
            .mapToObj(i -> Character.toString((char)i))
            .collect(StringBuilder::new, StringBuilder::append, StringBuilder::append)
            .toString();
    }

    public static String build(int len, String number, String firstName, String lastName) {
        firstName = encode(firstName);
        lastName = encode(lastName);
        int nlen = len - Math.min(firstName.length(), 3) - 1 - number.length();
        return (lastName.length() > nlen ? lastName.substring(0, nlen) : lastName) +
            '.' +
            (firstName.length() > 3 ? firstName.substring(0, 3) : firstName) +
            number;
    }

    public static String next(int len, List<String> similar, String firstName, String lastName) {
        String userid = build(len, "", firstName, lastName);
        if (similar.contains(userid)) {
            int i = 2;
            do {
                String number = "" + i++;
                userid = build(len, number, firstName, lastName);
            } while (similar.contains(userid));
        }
        else if (isForbidden(userid)) {
            int i = 1;
            do {
                String number = "" + i++;
                userid = build(len, number, firstName, lastName);
            } while (similar.contains(userid));
        }
        return userid;
    }

    private static boolean isForbidden(String userid) {
        return FORBIDDEN.contains(userid.substring(userid.length() - 3));
    }

    public static void main(String[] args) {
        System.out.println(build(18,"12","Fabian", "Talmonl`armee"));
        System.out.println(build(18,"123","Doğan", "Dinç"));
        System.out.println(build(18,"1234","Zeÿn", "Georgÿ"));
        System.out.println(build(18,"12345","Maximilian", "Müller"));
        System.out.println(build(16,"","Veronica", "Palacios Hildalgo"));

        test("Peter", "Müller");
        test("Peter", "Müller Mayer");
        test("Peter", "Müller Mayer-Schmidt");
        test("Peter", "abcdefghijklmnopq");
        test("Peter", "abcdefghijklmnop");
        test("Peter", "abcdefghijklmno");
        test("Peter", "abcdefghijklmn");
        test("Peter", "abcdefghijklm");
        test("Peter", "abcdefghijkl");
        test("Li", "abcdefghijklmnopq");
        test("Li", "abcdefghijklmnop");
        test("Li", "abcdefghijklmno");
        test("Li", "abcdefghijklmn");
        test("Li", "abcdefghijklm");
        test("Li", "abcdefghijkl");
        test("exe", "La");
        test("exe", "Li");
        test("exe", "Lu");
        test("exen", "La");
        test("exen", "Li");
        test("exen", "Lu");
    }

    private static void test(String firstName, String lastName) {
        List<String> existing = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            existing.add(next(18, existing, firstName, lastName));
        }
        System.out.println("existing = " + existing);
    }
}
