package com.billandserve.pos;

import android.content.Intent;
import android.net.Uri;
import android.content.ClipData;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "WhatsAppShare")
public class WhatsAppSharePlugin extends Plugin {

    @PluginMethod
    public void shareFile(PluginCall call) {
        String phone = call.getString("phone");
        String filePath = call.getString("filePath");
        String mimeType = call.getString("mimeType", "application/pdf");

        if (phone == null || phone.isEmpty()) {
            call.reject("Phone number is required");
            return;
        }
        if (filePath == null || filePath.isEmpty()) {
            call.reject("File path is required");
            return;
        }

        try {
            Uri parsedUri = Uri.parse(filePath);
            Uri contentUri;

            if ("content".equalsIgnoreCase(parsedUri.getScheme())) {
                contentUri = parsedUri;
            } else {
                File file;
                if ("file".equalsIgnoreCase(parsedUri.getScheme())) {
                    file = new File(parsedUri.getPath());
                } else if (filePath.startsWith("/")) {
                    file = new File(filePath);
                } else {
                    file = new File(getContext().getCacheDir(), filePath);
                }

                if (!file.exists()) {
                    call.reject("File not found: " + file.getAbsolutePath());
                    return;
                }

                contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
            }

            String formattedPhone = phone.replaceAll("[^0-9]", "");
            if (formattedPhone.length() == 10) {
                formattedPhone = "91" + formattedPhone;
            }
            String jid = formattedPhone.isEmpty() ? null : formattedPhone + "@s.whatsapp.net";

            String[] packagesToTry = new String[] { "com.whatsapp", "com.whatsapp.w4b" };
            boolean shared = false;

            for (String targetPackage : packagesToTry) {
                if (tryStartShare(targetPackage, contentUri, mimeType, jid)) {
                    shared = true;
                    break;
                }
                if (tryStartShare(targetPackage, contentUri, mimeType, null)) {
                    shared = true;
                    break;
                }
            }

            if (!shared) {
                call.reject("WhatsApp is not installed");
                return;
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Share failed: " + e.getMessage());
        }
    }

    private boolean tryStartShare(String targetPackage, Uri contentUri, String mimeType, String jid) {
        try {
            Intent sendIntent = buildSendIntent(targetPackage, contentUri, mimeType, jid);
            getActivity().startActivity(sendIntent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private Intent buildSendIntent(String targetPackage, Uri contentUri, String mimeType, String jid) {
        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.setType(mimeType);
        sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
        sendIntent.setClipData(ClipData.newUri(getContext().getContentResolver(), "invoice", contentUri));
        sendIntent.setPackage(targetPackage);
        if (jid != null && !jid.isEmpty()) {
            sendIntent.putExtra("jid", jid);
        }
        sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getContext().grantUriPermission(targetPackage, contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return sendIntent;
    }
}
