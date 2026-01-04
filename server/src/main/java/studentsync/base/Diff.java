package studentsync.base;

import java.io.PrintStream;
import java.sql.Date;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Created by holger on 20.12.14.
 */
public class Diff
{
    public List<Student> added;
    public List<Student> removed;
    public List<Student> kept;
    public List<Change> changed;
    public Map<String,List<Student>> more = new HashMap<>();
    public static final int COMPARE_CLASS = 1;
    public static final int COMPARE_GENDER = 2;
    public static final int COMPARE_BIRTHDAY = 4;
    public static final int COMPARE_FIRST_NAME = 8;
    public static final int COMPARE_LAST_NAME = 16;
    public static final int COMPARE_GENERIC = 32;
    private Map<String,String> notes = new HashMap<>();

    public Diff compare(List<Student> master, List<Student> slave, List<Pair> pairs, int flags) {
        Map<String, String> map = pairMap(pairs);
        for (Student student : master)
            if (map.containsKey(student.getClazz()))
                student.setClazz(map.get(student.getClazz()));

        added = new ArrayList<>(master);
        added.removeAll(slave);
        Collections.sort(added);

        removed = new ArrayList<>(slave);
        removed.removeAll(master);
        Collections.sort(removed);

        changed = new ArrayList<>();

        kept = new ArrayList<>(master);
        kept.retainAll(slave);
        Collections.sort(kept);
        if (flags == 0)
            return this;

        for (Iterator<Student> iterator = kept.iterator(); iterator.hasNext(); ) {
            Student masterStudent = iterator.next();
            Student slaveStudent = find(slave, masterStudent);
            if ((flags & COMPARE_FIRST_NAME) != 0 && different(masterStudent.getFirstName(), slaveStudent.getFirstName()) ||
                (flags & COMPARE_LAST_NAME) != 0 && different(masterStudent.getLastName(), slaveStudent.getLastName()) ||
                (flags & COMPARE_CLASS) != 0 && differentClass(pairs, masterStudent, slaveStudent) ||
                (flags & COMPARE_GENDER) != 0 && different(masterStudent.getGender(), slaveStudent.getGender()) ||
                (flags & COMPARE_BIRTHDAY) != 0 && different(masterStudent.getBirthday(), slaveStudent.getBirthday()) ||
                (flags & COMPARE_GENERIC) != 0 && different(masterStudent.getProperties(), slaveStudent.getProperties())
            )
            {
                changed.add(new Change(masterStudent, slaveStudent));
                iterator.remove();
            }
        }
        Collections.sort(changed);
        return this;
    }

    private Map<String, String> pairMap(List<Pair> pairs) {
        Map<String,String> map =  new HashMap<String, String>();
        for (Pair pair : pairs)
            map.put(pair.one, pair.other);
        return map;
    }

    private boolean different(Object one, Object other) {
        return one != null ? !one.equals(other) : other != null;
    }

    private boolean differentClass(List<Pair> pairs, Student masterStudent, Student slaveStudent) {
        if (masterStudent.clazz.equals(slaveStudent.clazz))
            return false;

        for (Pair pair : pairs) {
            if (pair.one.equals(masterStudent.clazz) && pair.other.equals(slaveStudent.clazz))
                return false;
        }

        return true;
    }

    private static Student find(List<Student> slave, Student masterStudent) {
        for (Student slaveStudent : slave) {
            if (slaveStudent.account.equals(masterStudent.account))
                return slaveStudent;
        }
        return null;
    }

    public static void listChanges(PrintStream output, List<Change> changed) {
        for (Change change : changed) {
            output.println(change);
        }
    }

    private static void csv(PrintStream output, List<Student> students) {
        for (Student student : students) {
            output.println("\"" + student.getClazz() + "\", \"" + student.getLastName() + "\", \"" + student.getFirstName() + "\"");
        }
    }

    public List<Student> getAdded() {
        return added;
    }

    public List<Student> getRemoved() {
        return removed;
    }

    public List<Student> getKept() {
        return kept;
    }

    public List<Change> getChanged() {
        return changed;
    }

    public void putList(String name, List<Student> students) {
        more.put(name, students);
    }
    public List<Student> getList(String name) {
        return more.get(name);
    }

    public void putNotes(Map<String, String> notes) {
        this.notes.putAll(notes);
    }

    public Map<String, String> getNotes() {
        return notes;
    }

    public static class Change extends Student {
        public Change(Student master, Student slave) {
            this.master = master;
            this.slave = slave;
        }

        public Student master;
        public Student slave;

        public Student getMaster() {
            return master;
        }

        public Student getSlave() {
            return slave;
        }

        @Override
        public String getAccount() {
            return getMaster().getAccount();
        }

        @Override
        public String getFirstName() {
            return getMaster().getFirstName();
        }

        @Override
        public String getLastName() {
            return getMaster().getLastName();
        }

        @Override
        public String getGender() {
            return getMaster().getGender();
        }

        @Override
        public Date getBirthday() {
            return getMaster().getBirthday();
        }

        @Override
        public String getClazz() {
            return getMaster().getClazz();
        }
        
        public String getFirstNameE() {
            return getMaster().getFirstName() == null ? getSlave().getFirstName() : getMaster().getFirstName().equals(getSlave().getFirstName()) ? null : getSlave().getFirstName();
        }

        public String getLastNameE() {
            return getMaster().getLastName() == null ? getSlave().getLastName() : getMaster().getLastName().equals(getSlave().getLastName()) ? null : getSlave().getLastName();
        }

        public String getGenderE() {
            return getMaster().getGender() == null ? getSlave().getGender() : getMaster().getGender().equals(getSlave().getGender()) ? null : getSlave().getGender();
        }

        public Date getBirthdayE() {
            return getMaster().getBirthday() == null ? getSlave().getBirthday() : getMaster().getBirthday().equals(getSlave().getBirthday()) ? null : getSlave().getBirthday();
        }

        public String getClazzE() {
            return getMaster().getClazz() == null ? getSlave().getClazz() : getMaster().getClazz().equals(getSlave().getClazz()) ? null : getSlave().getClazz();
        }
    }
}
