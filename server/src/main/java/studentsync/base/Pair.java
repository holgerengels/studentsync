package studentsync.base;

/**
 * Created by holger on 19.09.14.
 */
public class Pair {
    String one;
    String other;

    public Pair(String one, String other) {
        this.one = one;
        this.other = other;
    }

    public boolean identical() {
        return one.equals(other);
    }

    public Pair inverse() {
        return new Pair(other, one);
    }

    public String getOne() {
        return one;
    }

    public String getOther() {
        return other;
    }
}
