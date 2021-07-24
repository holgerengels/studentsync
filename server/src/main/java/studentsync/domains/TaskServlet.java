package studentsync.domains;

import jakarta.servlet.ServletConfig;
import jakarta.servlet.ServletException;
import studentsync.base.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.util.*;

/**
 * Created by holger on 09.05.16.
 */
public class TaskServlet<T>
    extends CorsServlet
{
    @Override
    public void init(ServletConfig config) throws ServletException {
        super.init(config);
        ScheduleManager.getInstance().init(config);
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
            Class<? extends Task> clazz = ScheduleManager.TASKS.get(taskName);
            if (clazz == null)
                System.out.println(".. not found in\n" + ScheduleManager.TASKS);
            Task<Report> task = ScheduleManager.getInstance().getTask(clazz);

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
