import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppTheme} from '../theme/ThemeContext';
import {useTranslation} from 'react-i18next';
import {ChatSettings} from '../utils/Storage';

const NUM_CTX_OPTIONS = [0, 2048, 4096, 8192, 16384];

interface Props {
    visible: boolean;
    settings: ChatSettings;
    onChange: (settings: ChatSettings) => void;
    onClose: () => void;
}

/**
 * 对话设置弹窗：温度 / Top P / 上下文长度
 * 每次调整立即生效并持久化（由父组件负责保存）
 */
const ChatSettingsModal = ({visible, settings, onChange, onClose}: Props) => {
    const theme = useAppTheme();
    const {t} = useTranslation();

    const update = (patch: Partial<ChatSettings>) => {
        onChange({...settings, ...patch});
    };

    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    const adjustTemperature = (delta: number) => {
        update({temperature: clamp(Math.round((settings.temperature + delta) * 10) / 10, 0, 2)});
    };

    const adjustTopP = (delta: number) => {
        update({topP: clamp(Math.round((settings.topP + delta) * 100) / 100, 0, 1)});
    };

    const adjustNumCtx = (delta: number) => {
        const idx = NUM_CTX_OPTIONS.indexOf(settings.numCtx);
        const next = NUM_CTX_OPTIONS[(idx + delta + NUM_CTX_OPTIONS.length) % NUM_CTX_OPTIONS.length];
        update({numCtx: next});
    };

    const reset = () => {
        onChange({temperature: 0.8, topP: 0.9, numCtx: 0});
    };

    const ctxLabel = settings.numCtx === 0 ? t('contextDefault') : String(settings.numCtx);

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: theme.colors.surface,
                            shadowColor: theme.colors.scrim,
                        },
                    ]}>
                    <View style={styles.header}>
                        <Icon name="tune" size={20} color={theme.colors.primary}/>
                        <Text style={[styles.title, {color: theme.colors.onSurface}]}>
                            {t('chatSettings')}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Icon name="close" size={20} color={theme.colors.onSurfaceVariant}/>
                        </TouchableOpacity>
                    </View>

                    {/* 温度 */}
                    <View style={styles.row}>
                        <Text style={[styles.label, {color: theme.colors.onSurface}]}>
                            {t('temperature')}
                        </Text>
                        <View style={styles.stepper}>
                            <TouchableOpacity
                                style={[styles.stepBtn, {backgroundColor: theme.colors.secondaryContainer}]}
                                onPress={() => adjustTemperature(-0.1)}>
                                <Icon name="remove" size={18} color={theme.colors.onSecondaryContainer}/>
                            </TouchableOpacity>
                            <Text style={[styles.value, {color: theme.colors.onSurface}]}>
                                {settings.temperature.toFixed(1)}
                            </Text>
                            <TouchableOpacity
                                style={[styles.stepBtn, {backgroundColor: theme.colors.secondaryContainer}]}
                                onPress={() => adjustTemperature(0.1)}>
                                <Icon name="add" size={18} color={theme.colors.onSecondaryContainer}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Top P */}
                    <View style={styles.row}>
                        <Text style={[styles.label, {color: theme.colors.onSurface}]}>
                            {t('topP')}
                        </Text>
                        <View style={styles.stepper}>
                            <TouchableOpacity
                                style={[styles.stepBtn, {backgroundColor: theme.colors.secondaryContainer}]}
                                onPress={() => adjustTopP(-0.05)}>
                                <Icon name="remove" size={18} color={theme.colors.onSecondaryContainer}/>
                            </TouchableOpacity>
                            <Text style={[styles.value, {color: theme.colors.onSurface}]}>
                                {settings.topP.toFixed(2)}
                            </Text>
                            <TouchableOpacity
                                style={[styles.stepBtn, {backgroundColor: theme.colors.secondaryContainer}]}
                                onPress={() => adjustTopP(0.05)}>
                                <Icon name="add" size={18} color={theme.colors.onSecondaryContainer}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 上下文长度 */}
                    <View style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={[styles.label, {color: theme.colors.onSurface}]}>
                                {t('contextLength')}
                            </Text>
                            <Text style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}>
                                {t('contextLengthHint')}
                            </Text>
                        </View>
                        <View style={styles.stepper}>
                            <TouchableOpacity
                                style={[styles.stepBtn, {backgroundColor: theme.colors.secondaryContainer}]}
                                onPress={() => adjustNumCtx(-1)}>
                                <Icon name="remove" size={18} color={theme.colors.onSecondaryContainer}/>
                            </TouchableOpacity>
                            <Text style={[styles.value, {color: theme.colors.onSurface}]}>
                                {ctxLabel}
                            </Text>
                            <TouchableOpacity
                                style={[styles.stepBtn, {backgroundColor: theme.colors.secondaryContainer}]}
                                onPress={() => adjustNumCtx(1)}>
                                <Icon name="add" size={18} color={theme.colors.onSecondaryContainer}/>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.resetBtn} onPress={reset}>
                        <Icon name="restore" size={16} color={theme.colors.primary}/>
                        <Text style={[styles.resetText, {color: theme.colors.primary}]}>
                            {t('restoreDefault')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        elevation: 8,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: {width: 0, height: 4},
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
        flex: 1,
    },
    closeBtn: {
        padding: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    label: {
        fontSize: 15,
    },
    hint: {
        fontSize: 11,
        marginTop: 2,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stepBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    value: {
        fontSize: 15,
        fontWeight: '600',
        minWidth: 56,
        textAlign: 'center',
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 14,
        paddingVertical: 8,
    },
    resetText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

export default ChatSettingsModal;