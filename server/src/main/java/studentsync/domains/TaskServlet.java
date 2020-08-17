package studentsync.domains;

import studentsync.base.*;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.util.*;

/**
 * Created by holger on 09.05.16.
 */
public class TaskServlet<T>
    extends CorsServlet
{
    private static final Map<String, Class<? extends Task>> TASKS = new HashMap<>(); static {
        TASKS.put("webuntis-external-id", WebuntisExternalIdTask.class);
        TASKS.put("svp-id-generator", SVPIdGeneratorTask.class);
        TASKS.put("asv-id-generator", ASVIdGeneratorTask.class);
        TASKS.put("bridge-sync", SVPReviewSyncTask.class);
        TASKS.put("ad-group-mapping", ADGroupMappingTask.class);
    }

    private Map<Class, Task> tasks = new HashMap<>();

    public synchronized <S extends Task> S getTask(Class<S> clazz) {
        System.out.println("task " + clazz.getSimpleName());
        return (S)tasks.computeIfAbsent(clazz, s -> createTask(clazz));
    }

    protected <G extends Task> G createTask(Class<G> clazz) {
        try {
            G instance = clazz.newInstance();
            return instance;
        }
        catch (IllegalAccessException | InstantiationException e) {
            e.printStackTrace();
            throw new RuntimeException(e);
        }
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws IOException
    {
        Map<String, String[]> parameterMap = req.getParameterMap();
        Map<String, String> map = new HashMap<>();
        parameterMap.forEach((key, values) -> { map.put(key, values[0]); });

        try {
            String taskName = map.get("task");
            System.out.println("task = " + taskName);
            Class<? extends Task> clazz = TASKS.get(taskName);
            if (clazz == null)
                System.out.println(".. not found in\n" + TASKS);
            Task<Report> task = getTask(clazz);

            task.setOutput(new PrintStream(new ByteArrayOutputStream()));
            Report report = task.execute();
            writeReport(req, resp, report);
        }
        catch (Exception e) {
            e.printStackTrace();
            sendError(req, resp, e);
        }
    }
}
