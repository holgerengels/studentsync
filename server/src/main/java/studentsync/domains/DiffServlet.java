package studentsync.domains;

import studentsync.base.*;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.util.*;

/**
 * Created by holger on 1/9/14.
 */
public class DiffServlet
        extends CorsServlet {
    private static final Map<String, Class<? extends Generator>> GENERATORS = new HashMap<>(); static {
        GENERATORS.put("diff", DiffGenerator.class);
        GENERATORS.put("added", AddedGenerator.class);
        GENERATORS.put("removed", RemovedGenerator.class);
        GENERATORS.put("changed", ChangedGenerator.class);
        GENERATORS.put("untis-import", UntisImportGenerator.class);
        GENERATORS.put("untis-religions", UntisReligionsGenerator.class);
        GENERATORS.put("paedml-import", PaedMLImportGenerator.class);
    }

    private Map<Class, Generator> generators = new HashMap<>();

    public synchronized <S extends Generator> S getGenerator(Class<S> clazz) {
        System.out.println("generator " + clazz.getSimpleName());
        return (S)generators.computeIfAbsent(clazz, s -> createGenerator(clazz));
    }

    protected <G extends Generator> G createGenerator(Class<G> clazz) {
        try {
            G instance = clazz.newInstance();
            instance.setConfig(Configuration.getInstance().getConfig());
            return instance;
        }
        catch (IllegalAccessException | InstantiationException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws ServletException, IOException
    {
        Map<String, String[]> parameterMap = req.getParameterMap();
        Map<String, String> map = new HashMap<>();
        parameterMap.forEach((key, values) -> { map.put(key, values[0]); });

        try {
            String master = map.getOrDefault("master", "asv");
            String slave = map.get("slave");
            System.out.println(master + " --> " + slave);
            DiffTask task = new DiffTask(master, slave);

            task.setOutput(new PrintStream(new ByteArrayOutputStream()));
            Diff diff = task.diff();

            corsHeaders(req, resp);
            String file = map.getOrDefault("file", "diff");
            if (file != null)
                getGenerator(GENERATORS.get(file)).write(resp, diff);
            else
                throw new RuntimeException("unknown artifact: " + file);
        }
        catch (Exception e) {
            e.printStackTrace();
            sendError(req, resp, e);
        }
    }

}
