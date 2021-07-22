package studentsync.domains;


import studentsync.base.Report;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.util.HashMap;
import java.util.Map;

/**
 * Created by holger on 1/9/14.
 */
public class SyncServlet
    extends CorsServlet
{
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
        throws IOException
    {
        Map<String, String[]> parameterMap = req.getParameterMap();
        Map<String, String> map = new HashMap<>();
        parameterMap.forEach((key, values) -> { map.put(key, values[0]); });

        try {
            String master = map.getOrDefault("master", "asv");
            String slave = map.get("slave");
            System.out.println(master + " --> " + slave);
            SyncTask task = new SyncTask(master, slave);
            task.setOutput(new PrintStream(new ByteArrayOutputStream()));
            Report report = task.sync();
            writeReport(req, resp, report);
        }
        catch (Exception e) {
            e.printStackTrace();
            sendError(req, resp, e);
        }
    }
}

