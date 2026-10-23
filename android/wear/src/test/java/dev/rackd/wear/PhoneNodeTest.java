package dev.rackd.wear;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class PhoneNodeTest {
    @Test
    public void prefersNearbyPhoneAppOverAnotherNearbyDevice() {
        assertEquals(
            "phone",
            PhoneNode.pick(
                Arrays.asList(node("tablet", false), node("phone", true)),
                Collections.singletonList(node("tablet", true))
            )
        );
    }

    @Test
    public void usesConnectedPhoneWhenCapabilityListIsEmpty() {
        assertEquals(
            "phone",
            PhoneNode.pick(Collections.emptyList(), Collections.singletonList(node("phone", true)))
        );
    }

    @Test
    public void prefersNearbyBluetoothWhenCapabilityNodeIsCloudOnly() {
        assertEquals(
            "phone-bt",
            PhoneNode.pick(
                Collections.singletonList(node("phone-cloud", false)),
                Collections.singletonList(node("phone-bt", true))
            )
        );
    }

    @Test
    public void usesCloudCapabilityWhenNothingIsConnected() {
        assertEquals(
            "phone",
            PhoneNode.pick(Collections.singletonList(node("phone", false)), Collections.emptyList())
        );
    }

    @Test
    public void usesCloudConnectionWhenCapabilityIsMissing() {
        assertEquals(
            "phone",
            PhoneNode.pick(null, Collections.singletonList(node("phone", false)))
        );
    }

    @Test
    public void returnsNullWhenNoPhoneIsPaired() {
        assertNull(PhoneNode.pick(Collections.emptyList(), Collections.emptyList()));
        assertNull(PhoneNode.pick(null, null));
    }

    @Test
    public void hasNearbyIgnoresCloudOnlyAndBlankNodes() {
        assertFalse(PhoneNode.hasNearby(Collections.singletonList(node("phone", false))));
        assertFalse(PhoneNode.hasNearby(Collections.singletonList(node("", true))));
        assertTrue(PhoneNode.hasNearby(Arrays.asList(node("cloud", false), node("phone", true))));
        assertFalse(PhoneNode.hasNearby(null));
    }

    @Test
    public void skipsBlankAndNullNodes() {
        assertEquals(
            "phone",
            PhoneNode.pick(
                Arrays.asList(null, node(null, true), node("", true), node("phone", false)),
                null
            )
        );
    }

    private static PhoneNode.Candidate node(String id, boolean nearby) {
        return new PhoneNode.Candidate(id, nearby);
    }
}
