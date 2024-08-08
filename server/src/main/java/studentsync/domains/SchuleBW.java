package studentsync.domains;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import dev.samstevens.totp.code.*;
import dev.samstevens.totp.exceptions.CodeGenerationException;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.cookie.BasicCookieStore;
import org.apache.hc.client5.http.cookie.CookieStore;
import org.apache.hc.client5.http.entity.UrlEncodedFormEntity;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.CloseableHttpResponse;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.apache.hc.client5.http.impl.cookie.BasicClientCookie;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.NameValuePair;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.message.BasicNameValuePair;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import studentsync.base.Configuration;
import studentsync.base.Domain;
import studentsync.base.Student;

import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

public class SchuleBW extends Domain {
    private List<Student> students;
    public SchuleBW() {
        super("schulebw");
    }

    public synchronized List<Student> readStudents() {
        if (students != null)
            return students;

        String url = getConfigString("url");
        if (!url.endsWith("/")) url += "/";
        String user = getConfigString("user");
        String password = getConfigString("password");
        String secret = getConfigString("secret");

        CookieStore cookieStore = new BasicCookieStore();
        CloseableHttpClient client = HttpClientBuilder.create().setDefaultCookieStore(cookieStore).build();

        start();
        try {
            String token;
            // login page .. obtain token
            HttpGet get = new HttpGet(url + "login");
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                token = document.head().select("meta[name=csrf-token]").attr("content");
                System.out.println("token = " + token);
                EntityUtils.consume(entity);
            }
            System.out.println("token = " + token);

            // login password
            List<NameValuePair> nameValuePairs = new ArrayList<>(3);
            nameValuePairs.add(new BasicNameValuePair("rpIdmPrimaryPrincipalName", user));
            nameValuePairs.add(new BasicNameValuePair("password", password));
            nameValuePairs.add(new BasicNameValuePair("_token", token));
            nameValuePairs.add(new BasicNameValuePair("activationCodeToken", ""));

            HttpPost post = new HttpPost(url + "login");
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            try (final CloseableHttpResponse response = client.execute(post)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                token = document.head().select("meta[name=csrf-token]").attr("content");
                System.out.println("token = " + token);
                EntityUtils.consume(entity);
            }

            /*
            // dashboard
            get = new HttpGet(url + "dashboard");
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String lala = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                //System.out.println("dashboard = " + lala);
                EntityUtils.consume(entity);
            }
             */

            // login 2fa
            nameValuePairs = new ArrayList<>(3);
            nameValuePairs.add(new BasicNameValuePair("one_time_secret", code(secret)));
            nameValuePairs.add(new BasicNameValuePair("_token", token));

            post = new HttpPost(url + "2faverify");
            post.setEntity(new UrlEncodedFormEntity(nameValuePairs));
            try (final CloseableHttpResponse response = client.execute(post)) {
                HttpEntity entity = response.getEntity();
                String string = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                Document document = Jsoup.parse(string);
                token = document.head().select("meta[name=csrf-token]").attr("content");
                System.out.println("token = " + token);
                EntityUtils.consume(entity);
            }

            /*
            // user dashboard
            get = new HttpGet(url + "dashboard");
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String lala = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                //System.out.println("dashboard = " + lala);
                EntityUtils.consume(entity);
            }

            get = new HttpGet(url + "orga");
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String lala = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                //System.out.println("orga = " + lala);
                EntityUtils.consume(entity);
            }
*/

            /*
            // user overview
            get = new HttpGet(url + "orga/user");
            get.addHeader("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"");
            get.addHeader("Sec-Ch-Ua-Mobile", "?0");
            get.addHeader("Sec-Ch-Ua-Platform", "\"Linux\"");
            get.addHeader("Sec-Fetch-Dest", "document");
            get.addHeader("Sec-Fetch-Mode", "cors");
            get.addHeader("Sec-Fetch-Site", "same-origin");
            get.addHeader("Sec-Fetch-User", "?1");
            get.addHeader("X-Csrf-Token", token);
            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                String lala = new String(entity.getContent().readAllBytes(), StandardCharsets.UTF_8);
                System.out.println("orga/user = " + lala);
                EntityUtils.consume(entity);
            }
             */

            // fetch users
            get = new HttpGet(url + "orga/user?perPage=500&page=1&orgaContextDN=bz1ERS1CVy1TTi0wNDEwMzQwODMwLG91PW9yZyxvdT1kYnAsZGM9Yndwcm9kLWxkYXA");
            get.addHeader("Accept",   "application/json, text/plain, */*");
            get.addHeader("Accept-Encoding",   "gzip, deflate, br");
            get.addHeader("Accept-Language",   "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7");
            get.addHeader("Connection",   "keep-alive");
            get.addHeader("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"");
            get.addHeader("Sec-Ch-Ua-Mobile", "?0");
            get.addHeader("Sec-Ch-Ua-Platform", "\"Linux\"");
            get.addHeader("Sec-Fetch-Dest", "empty");
            get.addHeader("Sec-Fetch-Mode", "cors");
            get.addHeader("Sec-Fetch-Site", "same-origin");
            //get.addHeader("Sec-Fetch-User", "?1");
            get.addHeader("X-Csrf-Token", token);
            get.addHeader("X-Requested-With", "XMLHttpRequest");
            get.addHeader("X-Xsrf-Token", URLDecoder.decode(cookieStore.getCookies().stream().filter(c -> c.getName().equals("XSRF-TOKEN")).toList().getFirst().getValue(), StandardCharsets.UTF_8));
            System.out.println(String.join("\n", cookieStore.getCookies().stream().map(c -> c.getName() + ": " + c.getValue()).toList()));
            System.out.println(String.join("\n", Arrays.stream(get.getHeaders()).map(c -> c.getName() + ": " + c.getValue()).toList()));

            try (final CloseableHttpResponse response = client.execute(get)) {
                HttpEntity entity = response.getEntity();
                JsonObject object = new Gson().fromJson(new InputStreamReader(entity.getContent()), JsonObject.class);
                String string = object.getAsJsonPrimitive("contentView").getAsString();

                students = new ArrayList<>();
                Document document = Jsoup.parse(string);
                for (Element element : document.body().select("tbody > tr")) {
                    String lastName = element.select("td").get(2).ownText();
                    String firstName = element.select("td").get(3).ownText();
                    String userID = element.select("td").get(4).ownText();
                    String role = element.select("td").get(5).ownText();
                    String groups = element.select("td").get(6).ownText();
                    System.out.println("role = " + role);
                    if ("Schüler*in".equals(role))
                        students.add(new Student(userID, firstName, lastName, null, null, groups.split(" ")[0]));
                    else
                        students.add(new Student(userID, firstName, lastName));
                    //System.out.println(userID + " " + firstName + " " + lastName);
                }

                EntityUtils.consume(entity);
            }
        }
        catch (IOException e) {
            Logger.getLogger(getClass().getSimpleName()).log(Level.SEVERE, e.getMessage(), e);
            throw new RuntimeException(e.getMessage());
        }
        finally {
            stop("read students");
        }
        Collections.sort(students);
        return students;
    }

    public String code(String secret) {
        try {
            TimeProvider timeProvider = new SystemTimeProvider();
            CodeGenerator codeGenerator = new DefaultCodeGenerator();
            long time = Math.round(Math.floor(timeProvider.getTime()/30.0));
            return codeGenerator.generate(secret, time);
        } catch (CodeGenerationException e) {
            throw new RuntimeException(e);
        }
    }

    public static void main(String[] args) {
        Configuration.getInstance().setConfigPath(args[0]);
        SchuleBW domain = new SchuleBW();
        System.out.println(domain.code(domain.getConfigString("secret")));
        List<Student> students = new SchuleBW().readStudents();
        Student.listStudents(System.out, students);
    }
}

// NSC_mc_wt_cxtdivmf=ffffffff09d41f9245525d5f4f58455e445a4a42378b; XSRF-TOKEN=eyJpdiI6IlBUeTU4R1RSZTk5Ukd6T202VjJkeFE9PSIsInZhbHVlIjoicUVKaVdFMm9OcjVQUlN6R2NEcThISFp3TnpOTjVIczFnbTZIclg4RVJhWkt3WDNvZHJrL0dGRHRTM1IwbHVGVzZpeUFPVDNvRHJaYXVGWWxGd1RYK1kxdFZrb3g2aHpkY0N6aUlRa0YwMWtNK0Q2NThocEZUc09Xbm5YYysvemciLCJtYWMiOiI4M2Q3MGYxYjk2M2QzY2E2NjAxMGQ2ZThmYzdkNzU4OWQwYmE4Yzc0MjQ2MzY2MmRmNzU5M2NjZTgyM2U1ZTVkIiwidGFnIjoiIn0%3D; schule_at_bw_session=eyJpdiI6IkZDN0hiQXlOMTA0aTFCemtaUnpjVHc9PSIsInZhbHVlIjoiSDBLOEN0eVFac2VuTWVjOTJ6TWo4a0RVUTZBbWJnS0pmdU9IZ1puWE9MQXNDeE1ta29CUXRHSS8rZEF2SzZNUm9lOFg2eURjbGRWdUNDRjJKMUlRMVVTT24yRHJpZ0d6VFlCYnFPQXByYitGc0VmOUVqZnJtL0YrSjgxM09RZDAiLCJtYWMiOiJmYTMxYzM4N2Q3M2Q4YmY0MDM1NDBkM2JhMTc3OGU3MmE0MzI0NWUyNTdjYTY2YjJhMTY3YWVmNWFiMzY4ZGQ1IiwidGFnIjoiIn0%3D
// NSC_mc_wt_cxtdivmf=ffffffff09d41f9245525d5f4f58455e445a4a42378b; XSRF-TOKEN=eyJpdiI6ImlBTDA5Nm5iYm5UKzdVeEk3QXhZN0E9PSIsInZhbHVlIjoiZWx2N3BCZXhhUUdleHNyc3B5L2x0SzNnWnVFR2Ivb2g5MEVIQVMvaDhGRjNaTUx2YzhCeVFNWm9tZDB1THduYTV4VUd4RW1lRUE4QlpLeVhKeWhaMTRPZEhPTmk2dll6SmNxZUc3NlgvUnpmQnhNaGw0bFMvUWpuaytjeHVYcVIiLCJtYWMiOiIwYzFhNzNhNGE5ZWVkM2RmYTI2ZDRhMGQxZTJjMjViYWEzYzdlNGZmMmE4NWU3NjkwYzBhMTU4Njk0NjI0ZWRiIiwidGFnIjoiIn0%3D; schule_at_bw_session=eyJpdiI6IlVnTlZ6Sk53aEYwaGtqeklpaERFOGc9PSIsInZhbHVlIjoia3ZMZ0RRb0xhRU4zNC9Gdm9yOGdoNTJNcXo0UGhIcXBXN1pDd3hzK0k1U3IrSENjU0dSc3pvaGxNUjRjd2lZNy9IbzVoNTdPMVozWmJocndJbVlWc2FsOHhDakM2VUZzOUh2b0Z4QTNIQXFoOUV3UVhIQTNsMHZZekFuaUdiZW4iLCJtYWMiOiI2NTJhMzEyNTE2YTgyMTE1MWUwZjc2YTNjODZmNmVmZDIyYzQ0MjA5YjgyY2JkODljNTVkYWM4MTI2NGUzMzhlIiwidGFnIjoiIn0%3D