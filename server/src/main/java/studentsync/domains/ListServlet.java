package studentsync.domains;

import com.google.gson.JsonObject;
import studentsync.base.*;

import javax.json.Json;
import javax.json.JsonWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.*;

import static studentsync.domains.JSON.json;

/**
 * Created by holger on 1/9/14.
 */
public class ListServlet
    extends CorsServlet
{
    private static final Map<String, Class<? extends Generator>> GENERATORS = new HashMap<>(); static {
        GENERATORS.put("csv", CSVGenerator.class);
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Map<String, String[]> parameterMap = req.getParameterMap();
        Map<String, String> map = new HashMap<>();
        parameterMap.forEach((key, values) -> { map.put(key, values[0]); });

        try {
            String domain = map.get("domain");
            String search = map.get("search");
            String file = map.get("file");
            ListTask task = new ListTask(domain);

            List<Student> list = search != null ? task.filter(search) : task.list();

            if (file != null)
                getGenerator(GENERATORS.get(file)).write(resp, list);
            else
                writeJson(req, resp, list);
        }
        catch (Exception e) {
            e.printStackTrace();
            sendError(req, resp, e);
        }
    }

    protected void writeJson(HttpServletRequest req, HttpServletResponse resp, List list) throws IOException {
        corsHeaders(req, resp);
        resp.setContentType("application/json");
        resp.setCharacterEncoding("utf-8");
        JsonWriter writer = Json.createWriter(resp.getWriter());
        writer.writeArray(json(list));
        writer.close();
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
}
